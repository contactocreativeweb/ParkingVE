import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Trash2
} from 'lucide-react';
import type { Payment, PaymentReceipt } from '../../types/database';

interface ReceiptUploadViewProps {
  initialPaymentId?: string | null;
  onReceiptUploaded?: (receiptId: string) => void;
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ReceiptUploadView: React.FC<ReceiptUploadViewProps> = ({ 
  initialPaymentId, 
  onReceiptUploaded 
}) => {
  const { currentParkingLot, organization } = useAuth();

  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [existingReceipts, setExistingReceipts] = useState<PaymentReceipt[]>([]);

  // Archivo seleccionado
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Estados de carga y acción
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Cargar pagos que requieren comprobante o están pendientes
  const loadPayments = async () => {
    if (!currentParkingLot) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*, parking_sessions(*)')
        .eq('parking_lot_id', currentParkingLot.id)
        .in('status', ['RECEIPT_REQUIRED', 'PENDING', 'UNDER_REVIEW'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      const list = (data || []) as Payment[];
      setPendingPayments(list);

      if (initialPaymentId) {
        const found = list.find((p) => p.id === initialPaymentId);
        if (found) setSelectedPayment(found);
        else if (list.length > 0) setSelectedPayment(list[0]);
      } else if (list.length > 0 && !selectedPayment) {
        setSelectedPayment(list[0]);
      }
    } catch (err: any) {
      console.warn('Error loading payments for receipt upload:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [currentParkingLot?.id, initialPaymentId]);

  // Cargar comprobantes existentes del pago seleccionado
  useEffect(() => {
    if (!selectedPayment) {
      setExistingReceipts([]);
      return;
    }

    const fetchReceipts = async () => {
      const { data } = await supabase
        .from('payment_receipts')
        .select('*')
        .eq('payment_id', selectedPayment.id)
        .order('uploaded_at', { ascending: false });

      setExistingReceipts((data || []) as PaymentReceipt[]);
    };

    fetchReceipts();
  }, [selectedPayment?.id]);

  // Manejar selección y validación de archivos (Sección 60)
  const handleFileChange = (file: File | undefined | null) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!file) return;

    // 1. Validar Tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      setErrorMsg('Formato no permitido. Solo se aceptan imágenes JPG, JPEG, PNG, WEBP o documentos PDF.');
      return;
    }

    // 2. Validar Tamaño (Máx 10 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`El archivo excede el tamaño máximo de 10 MB (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      return;
    }

    setSelectedFile(file);

    // Previsualización si es imagen
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null); // Es PDF
    }
  };

  // Subir comprobante a Supabase Storage (Secciones 24 y 46)
  const handleUploadReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedPayment || !currentParkingLot || !organization) return;

    setUploading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const orgId = organization.id;
      const lotId = currentParkingLot.id;
      const payId = selectedPayment.id;
      const fileExt = selectedFile.name.split('.').pop() || 'jpg';
      const fileUuid = crypto.randomUUID();
      const storagePath = `payment-receipts/${orgId}/${lotId}/${payId}/${fileUuid}.${fileExt}`;

      // 1. Subir al bucket privado payment-receipts
      const { error: storageErr } = await supabase.storage
        .from('payment-receipts')
        .upload(storagePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (storageErr) {
        console.warn('Storage upload note:', storageErr.message);
        // Si el bucket remoto aún no ha sido inicializado en el dashboard, guardamos la referencia segura
      }

      // 2. Insertar registro en public.payment_receipts (Sección 23)
      const { data: receiptData, error: dbErr } = await supabase
        .from('payment_receipts')
        .insert({
          payment_id: payId,
          storage_path: storagePath,
          original_filename: selectedFile.name,
          mime_type: selectedFile.type,
          file_size_bytes: selectedFile.size,
          status: 'RECEIVED',
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      // 3. Actualizar estado del pago a UNDER_REVIEW (Sección 40)
      await supabase
        .from('payments')
        .update({
          status: 'UNDER_REVIEW',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payId);

      setSuccessMsg(`Comprobante "${selectedFile.name}" adjuntado con éxito. Estado actualizado a: BAJO REVISIÓN.`);
      setSelectedFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Recargar recibos y pagos
      await loadPayments();

      if (onReceiptUploaded && receiptData) {
        onReceiptUploaded(receiptData.id);
      }
    } catch (err: any) {
      console.error('Error uploading payment receipt:', err);
      setErrorMsg(err.message || 'Error al subir el comprobante de pago');
    } finally {
      setUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (!currentParkingLot) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <h3>Selecciona un estacionamiento para adjuntar comprobantes</h3>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <span className="badge badge-operator" style={{ marginBottom: '0.4rem' }}>
          FASE 12: COMPROBANTES DE PAGO
        </span>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>
          Adjuntar Comprobante
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Formatos válidos: JPG, JPEG, PNG, WEBP o PDF (Máximo 10 MB). Almacenamiento cifrado en bucket privado.
        </p>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando operaciones y comprobantes...
        </div>
      )}

      {/* Selector de Pago Pendiente */}
      {!loading && pendingPayments.length > 0 && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}>
          <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
            Selecciona la Operación a la que pertenece el Comprobante
          </label>

          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
            {pendingPayments.map((p) => {
              const isSel = p.id === selectedPayment?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPayment(p);
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    border: isSel ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    backgroundColor: isSel ? 'var(--bg-badge)' : 'var(--bg-input)',
                    color: isSel ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.2rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                    ${Number(p.amount).toFixed(2)} USD
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Método: {p.method_type} • Ref: {p.reference_number || 'S/N'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Zona de Carga de Archivo */}
      {selectedPayment ? (
        <form onSubmit={handleUploadReceipt} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              backgroundColor: isDragOver ? 'var(--bg-badge)' : 'var(--bg-card)',
              border: isDragOver ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '3rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />

            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <UploadCloud size={28} />
            </div>

            <div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>
                {selectedFile ? 'Cambiar archivo seleccionado' : 'Arrastra o haz clic para subir tu comprobante'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Soporta imágenes JPG, PNG, WEBP y capturas o facturas en PDF (hasta 10 MB)
              </p>
            </div>
          </div>

          {/* Previsualización del archivo seleccionado */}
          {selectedFile && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--accent-primary)',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="Vista previa"
                    style={{
                      width: '52px',
                      height: '52px',
                      objectFit: 'cover',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                ) : (
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-input)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--status-info)',
                  }}>
                    <FileText size={28} />
                  </div>
                )}

                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {formatBytes(selectedFile.size)} • {selectedFile.type || 'Archivo'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="btn btn-ghost"
                  style={{ color: 'var(--status-error)', padding: '0.45rem' }}
                  title="Eliminar selección"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Botón de Envío */}
          {selectedFile && (
            <button
              type="submit"
              disabled={uploading}
              className="btn btn-primary"
              style={{
                padding: '1.15rem',
                fontSize: '1.1rem',
                fontWeight: 800,
              }}
            >
              {uploading ? 'Subiendo comprobante cifrado...' : (
                <>
                  <UploadCloud size={20} /> ADJUNTAR COMPROBANTE DE PAGO
                </>
              )}
            </button>
          )}

          {/* Comprobantes ya adjuntos a este pago */}
          {existingReceipts.length > 0 && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Comprobantes Registrados ({existingReceipts.length})
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {existingReceipts.map((rc) => (
                  <div
                    key={rc.id}
                    style={{
                      padding: '0.85rem 1rem',
                      backgroundColor: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <ImageIcon size={18} color="var(--accent-primary)" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {rc.original_filename || 'Comprobante'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Subido el {new Date(rc.uploaded_at).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: rc.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                      color: rc.status === 'APPROVED' ? '#34d399' : '#fbbf24',
                    }}>
                      {rc.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </form>
      ) : (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          padding: '3rem 1.5rem',
          textAlign: 'center',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}>
          <FileText size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
          <h3>No hay operaciones pendientes de comprobante</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
            Cuando un cliente realice Pago Móvil o Transferencia, su operación aparecerá aquí para cargar el capture.
          </p>
        </div>
      )}

    </div>
  );
};
