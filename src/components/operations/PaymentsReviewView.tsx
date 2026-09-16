import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Search, 
  RefreshCw, 
  Car, 
  Smartphone, 
  CreditCard, 
  Building, 
  Banknote, 
  Clock, 
  AlertCircle, 
  X, 
  FileText
} from 'lucide-react';
import { logAuditEvent } from '../../lib/audit';
import type { Payment, ParkingSession, Customer, PaymentReceipt } from '../../types/database';

interface PaymentWithDetails extends Payment {
  parking_sessions?: (ParkingSession & { customers?: Customer | null }) | null;
  payment_receipts?: PaymentReceipt[] | null;
}

interface PaymentsReviewViewProps {
  onPaymentApproved?: (payment: Payment) => void;
}

export const PaymentsReviewView: React.FC<PaymentsReviewViewProps> = ({ onPaymentApproved }) => {
  const { currentParkingLot, organization, user } = useAuth();

  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNDER_REVIEW' | 'RECEIPT_REQUIRED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal para ver Comprobante
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Modal para Rechazar Pago (Sección 40: rejection_reason obligatorio)
  const [rejectingPayment, setRejectingPayment] = useState<PaymentWithDetails | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  const loadPendingPayments = async () => {
    if (!currentParkingLot) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          parking_sessions (
            *,
            customers (*)
          ),
          payment_receipts (*)
        `)
        .eq('parking_lot_id', currentParkingLot.id)
        .in('status', ['UNDER_REVIEW', 'RECEIPT_REQUIRED', 'PENDING'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments((data || []) as PaymentWithDetails[]);
    } catch (err: any) {
      console.error('Error fetching payments for review:', err);
      setErrorMsg(err.message || 'Error al consultar pagos pendientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingPayments();
  }, [currentParkingLot?.id]);

  // Generar URL firmada temporal para ver comprobante en Storage privado (Sección 46)
  const handleViewReceipt = async (receipt: PaymentReceipt) => {
    setLoadingPreview(true);
    setPreviewFileName(receipt.original_filename || 'Comprobante');
    setIsPreviewModalOpen(true);
    setPreviewUrl(null);

    try {
      const { data, error } = await supabase.storage
        .from('payment-receipts')
        .createSignedUrl(receipt.storage_path, 600); // 10 minutos de vigencia

      if (error) {
        console.warn('Storage signed URL note:', error.message);
        // Si no se puede generar del bucket, mostrar mensaje amigable
      }

      if (data?.signedUrl) {
        setPreviewUrl(data.signedUrl);
      }
    } catch (err: any) {
      console.error('Error creating signed URL:', err);
    } finally {
      setLoadingPreview(false);
    }
  };

  // APROBAR PAGO (Sección 40 y 61)
  const handleApprove = async (payment: PaymentWithDetails) => {
    if (!user) return;
    setProcessingId(payment.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const nowIso = new Date().toISOString();

      // 1. Actualizar Pago a APPROVED
      const { error: payErr } = await supabase
        .from('payments')
        .update({
          status: 'APPROVED',
          paid_at: nowIso,
          reviewed_at: nowIso,
          reviewed_by: user.id,
          rejection_reason: null,
          updated_at: nowIso,
        })
        .eq('id', payment.id);

      if (payErr) throw payErr;

      if (organization?.id && currentParkingLot?.id && user?.id) {
        logAuditEvent({
          organizationId: organization.id,
          parkingLotId: currentParkingLot.id,
          userId: user.id,
          action: 'APPROVE',
          entityType: 'payments',
          entityId: payment.id,
          metadata: {
            description: `Pago aprobado: $${Number(payment.amount).toFixed(2)} USD`,
            amount: payment.amount,
            method_type: payment.method_type,
            reference_number: payment.reference_number,
          },
        });
      }

      // 2. Si tenía comprobante, marcarlo APPROVED
      if (payment.payment_receipts && payment.payment_receipts.length > 0) {
        await supabase
          .from('payment_receipts')
          .update({
            status: 'APPROVED',
            reviewed_at: nowIso,
            reviewed_by: user.id,
          })
          .eq('payment_id', payment.id);
      }

      setSuccessMsg(`Pago de $${Number(payment.amount).toFixed(2)} USD aprobado exitosamente.`);
      await loadPendingPayments();

      if (onPaymentApproved) {
        onPaymentApproved(payment);
      }
    } catch (err: any) {
      console.error('Error approving payment:', err);
      setErrorMsg(err.message || 'Error al aprobar el pago');
    } finally {
      setProcessingId(null);
    }
  };

  // Abrir diálogo para RECHAZAR PAGO (Sección 40: motivo obligatorio)
  const openRejectModal = (payment: PaymentWithDetails) => {
    setRejectingPayment(payment);
    setRejectionReason('');
    setErrorMsg(null);
  };

  // Confirmar Rechazo
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingPayment || !user) return;

    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      setErrorMsg('El motivo de rechazo es obligatorio para registrar la no conformidad.');
      return;
    }

    setSubmittingReject(true);
    setErrorMsg(null);

    try {
      const nowIso = new Date().toISOString();

      // 1. Actualizar Pago a REJECTED con rejection_reason obligatorio
      const { error: payErr } = await supabase
        .from('payments')
        .update({
          status: 'REJECTED',
          rejection_reason: trimmedReason,
          reviewed_at: nowIso,
          reviewed_by: user.id,
          updated_at: nowIso,
        })
        .eq('id', rejectingPayment.id);

      if (payErr) throw payErr;

      if (organization?.id && currentParkingLot?.id && user?.id) {
        logAuditEvent({
          organizationId: organization.id,
          parkingLotId: currentParkingLot.id,
          userId: user.id,
          action: 'REJECT',
          entityType: 'payments',
          entityId: rejectingPayment.id,
          metadata: {
            description: `Pago rechazado: $${Number(rejectingPayment.amount).toFixed(2)} USD - Motivo: "${trimmedReason}"`,
            amount: rejectingPayment.amount,
            method_type: rejectingPayment.method_type,
            rejection_reason: trimmedReason,
          },
        });
      }

      // 2. Marcar comprobante REJECTED
      if (rejectingPayment.payment_receipts && rejectingPayment.payment_receipts.length > 0) {
        await supabase
          .from('payment_receipts')
          .update({
            status: 'REJECTED',
            rejection_reason: trimmedReason,
            reviewed_at: nowIso,
            reviewed_by: user.id,
          })
          .eq('payment_id', rejectingPayment.id);
      }

      setSuccessMsg(`Pago rechazado debidamente. Motivo: "${trimmedReason}".`);
      setRejectingPayment(null);
      await loadPendingPayments();
    } catch (err: any) {
      console.error('Error rejecting payment:', err);
      setErrorMsg(err.message || 'Error al registrar el rechazo');
    } finally {
      setSubmittingReject(false);
    }
  };

  // Filtrado de pagos
  const filteredPayments = payments.filter((p) => {
    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'UNDER_REVIEW' && p.status === 'UNDER_REVIEW') ||
      (statusFilter === 'RECEIPT_REQUIRED' && p.status === 'RECEIPT_REQUIRED');

    if (!matchesStatus) return false;

    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const plate = p.parking_sessions?.plate_snapshot?.toLowerCase() || '';
    const cust = p.parking_sessions?.customers;
    const name = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.toLowerCase() : '';
    const ref = (p.reference_number || '').toLowerCase();

    return plate.includes(term.replace(/[^a-z0-9]/g, '')) || name.includes(term) || ref.includes(term);
  });

  const getMethodIcon = (methodType: string) => {
    switch (methodType) {
      case 'MOBILE_PAYMENT':
        return <Smartphone size={18} color="var(--accent-primary)" />;
      case 'POS':
        return <CreditCard size={18} color="var(--accent-secondary)" />;
      case 'CASH':
        return <Banknote size={18} color="var(--status-success)" />;
      case 'BANK_TRANSFER':
        return <Building size={18} color="#fbbf24" />;
      default:
        return <CreditCard size={18} />;
    }
  };

  const getMethodLabel = (methodType: string) => {
    switch (methodType) {
      case 'MOBILE_PAYMENT':
        return 'Pago Móvil';
      case 'POS':
        return 'Punto de Venta';
      case 'CASH':
        return 'Efectivo';
      case 'BANK_TRANSFER':
        return 'Transferencia';
      default:
        return methodType;
    }
  };

  if (!currentParkingLot) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <h3>Selecciona un estacionamiento para revisar pagos</h3>
      </div>
    );
  }

  const underReviewCount = payments.filter((p) => p.status === 'UNDER_REVIEW').length;

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-operator">FASE 13: REVISIÓN DE PAGOS</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Pagos Pendientes de Revisión</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Inspecciona comprobantes adjuntos, verifica referencias y autoriza la salida de los vehículos.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPendingPayments}
          disabled={loading}
          className="btn btn-secondary"
          title="Recargar pagos"
          style={{ fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
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

      {/* Filtros y Métricas Rápidas */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: statusFilter === 'ALL' ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              backgroundColor: statusFilter === 'ALL' ? 'var(--bg-badge)' : 'var(--bg-card)',
              color: statusFilter === 'ALL' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            }}
          >
            Todos ({payments.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('UNDER_REVIEW')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: statusFilter === 'UNDER_REVIEW' ? '1px solid #fbbf24' : '1px solid var(--border-subtle)',
              backgroundColor: statusFilter === 'UNDER_REVIEW' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-card)',
              color: statusFilter === 'UNDER_REVIEW' ? '#fbbf24' : 'var(--text-secondary)',
            }}
          >
            Por Revisar ({underReviewCount})
          </button>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          padding: '0.4rem 1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          minWidth: '260px',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            className="input-field"
            style={{ border: 'none', padding: '0.2rem 0', backgroundColor: 'transparent', boxShadow: 'none', fontSize: '0.85rem' }}
            placeholder="Buscar por placa, cliente o ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Lista de Pagos Pendientes (Sección 61) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Cargando operaciones pendientes de revisión...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <ClipboardCheck size={44} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.15rem' }}>No hay pagos pendientes de revisión</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
              Todas las operaciones de cobro se encuentran al día.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredPayments.map((payment, index) => {
              const sess = payment.parking_sessions;
              const cust = sess?.customers;
              const receipts = payment.payment_receipts || [];
              const hasReceipt = receipts.length > 0;
              const isProcessing = processingId === payment.id;

              return (
                <div
                  key={payment.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem 1.5rem',
                    borderBottom: index < filteredPayments.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    flexWrap: 'wrap',
                    gap: '1.25rem',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Columna 1: Matrícula y Vehículo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '180px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--accent-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Car size={22} />
                    </div>
                    <div>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        fontSize: '1.25rem',
                        color: 'var(--text-primary)',
                      }}>
                        {sess?.plate_snapshot || 'VEHÍCULO'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {sess?.vehicle_type_snapshot === 'CAR' ? 'Carro' : 'Moto'}
                      </div>
                    </div>
                  </div>

                  {/* Columna 2: Cliente */}
                  <div style={{ minWidth: '160px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Cliente
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                      {cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : 'Cliente Ocasional'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {cust?.phone || payment.customer_phone || 'Sin teléfono'}
                    </div>
                  </div>

                  {/* Columna 3: Monto y Método */}
                  <div style={{ minWidth: '150px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Monto & Método
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      color: 'var(--status-success)',
                      marginTop: '0.15rem',
                    }}>
                      ${Number(payment.amount).toFixed(2)} USD
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {getMethodIcon(payment.method_type)}
                      <span>{getMethodLabel(payment.method_type)}</span>
                      {payment.reference_number && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          (Ref: {payment.reference_number})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Columna 4: Fecha y Comprobante */}
                  <div style={{ minWidth: '160px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Fecha & Comprobante
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                      <Clock size={13} />
                      {new Date(payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(payment.created_at).toLocaleDateString()}
                    </div>

                    <div style={{ marginTop: '0.35rem' }}>
                      {hasReceipt ? (
                        <button
                          type="button"
                          onClick={() => handleViewReceipt(receipts[0])}
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          <Eye size={13} /> Ver Comprobante ({receipts.length})
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 600 }}>
                          Esperando capture...
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Columna 5: Acciones (APROBAR / RECHAZAR) (Sección 61) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleApprove(payment)}
                      className="btn btn-primary"
                      style={{
                        padding: '0.5rem 0.9rem',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        backgroundColor: '#10b981',
                        borderColor: '#10b981',
                      }}
                    >
                      <CheckCircle2 size={16} /> APROBAR
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => openRejectModal(payment)}
                      className="btn btn-ghost"
                      style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.85rem',
                        color: 'var(--status-error)',
                      }}
                    >
                      <XCircle size={16} /> RECHAZAR
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Visualizador de Comprobante Cifrado */}
      {isPreviewModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={18} color="var(--accent-primary)" /> {previewFileName}
              </h3>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="btn btn-ghost"
                style={{ padding: '0.25rem' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              flex: 1,
              padding: '1.5rem',
              overflowY: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '260px',
              backgroundColor: 'var(--bg-main)',
            }}>
              {loadingPreview ? (
                <div style={{ color: 'var(--text-muted)' }}>Cargando comprobante seguro...</div>
              ) : previewUrl ? (
                previewFileName.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewUrl}
                    title="Comprobante PDF"
                    style={{ width: '100%', height: '400px', border: 'none', borderRadius: 'var(--radius-md)' }}
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Comprobante"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '480px',
                      objectFit: 'contain',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-md)',
                    }}
                  />
                )
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FileText size={40} style={{ margin: '0 auto 0.5rem' }} />
                  <div>Comprobante registrado en base de datos.</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Archivo: {previewFileName}
                  </div>
                </div>
              )}
            </div>

            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="btn btn-secondary"
              >
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Rechazo (Sección 40: rejection_reason obligatorio) */}
      {rejectingPayment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          zIndex: 100,
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--status-error)',
            boxShadow: 'var(--shadow-lg)',
            maxWidth: '480px',
            width: '100%',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--status-error)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <XCircle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Rechazar Pago</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Operación: ${Number(rejectingPayment.amount).toFixed(2)} USD
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Indica con claridad el motivo por el cual se rechaza este pago o comprobante (ej: monto incorrecto, número de referencia ilegible o no acreditado en cuenta bancaria).
            </p>

            <form onSubmit={handleConfirmReject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Motivo de Rechazo * (Obligatorio)</label>
                <textarea
                  required
                  rows={3}
                  className="input-field"
                  placeholder="Ej. La referencia bancaria no coincide con el estado de cuenta..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setRejectingPayment(null)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingReject || !rejectionReason.trim()}
                  className="btn"
                  style={{
                    backgroundColor: 'var(--status-error)',
                    color: '#fff',
                    fontWeight: 700,
                  }}
                >
                  {submittingReject ? 'Rechazando...' : 'Confirmar Rechazo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
