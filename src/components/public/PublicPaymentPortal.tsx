import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Car,
  Clock,
  CreditCard,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Building2,
  Calendar,
  Hash,
  DollarSign,
  Smartphone,
  Banknote,
  Send,
  ImageIcon,
  FileText,
  ArrowRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PortalState =
  | 'loading'
  | 'invalid'
  | 'expired'
  | 'already_paid'
  | 'ready'
  | 'uploading'
  | 'success';

interface PaymentDetails {
  linkId: string;
  linkType: string;
  paymentId: string;
  amount: number;
  currencyCode: string;
  paymentStatus: string;
  paymentMethodType: string | null;
  referenceNumber: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  plate: string;
  vehicleType: string;
  entryAt: string;
  exitAt: string | null;
  parkingLotName: string;
  parkingLotAddress: string | null;
  parkingLotPhone: string | null;
  paymentMethods: PaymentMethodInfo[];
}

interface PaymentMethodInfo {
  id: string;
  methodType: string;
  displayName: string;
  bankName: string | null;
  accountHolder: string | null;
  identificationNumber: string | null;
  phoneNumber: string | null;
  instructions: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount).replace('VES', 'Bs.');
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-VE', {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function calcDuration(entryAt: string, exitAt: string | null): string {
  const start = new Date(entryAt).getTime();
  const end = exitAt ? new Date(exitAt).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${minutes}min`;
}

function methodIcon(type: string | null) {
  switch (type) {
    case 'MOBILE_PAYMENT': return <Smartphone size={18} />;
    case 'BANK_TRANSFER': return <Banknote size={18} />;
    case 'POS': return <CreditCard size={18} />;
    default: return <DollarSign size={18} />;
  }
}

function methodLabel(type: string | null) {
  switch (type) {
    case 'CASH': return 'Efectivo';
    case 'POS': return 'Punto de Venta (POS)';
    case 'MOBILE_PAYMENT': return 'Pago Móvil';
    case 'BANK_TRANSFER': return 'Transferencia Bancaria';
    default: return type ?? 'N/A';
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  tokenHash: string;
}

export const PublicPaymentPortal: React.FC<Props> = ({ tokenHash }) => {
  const [state, setState] = useState<PortalState>('loading');
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const loadPortal = useCallback(async () => {
    setState('loading');
    try {
      const { data: linkRow, error: linkErr } = await supabase
        .from('public_payment_links')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (linkErr || !linkRow) { setState('invalid'); return; }
      if (!linkRow.is_active) { setState('invalid'); return; }
      if (linkRow.expires_at && new Date(linkRow.expires_at) < new Date()) {
        setState('expired'); return;
      }

      const paymentId = linkRow.payment_id;
      const sessionId = linkRow.session_id;
      const parkingLotId = linkRow.parking_lot_id;

      if (!paymentId) { setState('invalid'); return; }

      const { data: payment, error: payErr } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .maybeSingle();

      if (payErr || !payment) { setState('invalid'); return; }
      if (['APPROVED', 'CANCELLED'].includes(payment.status)) {
        setState('already_paid'); return;
      }

      const { data: session } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      const { data: lot } = await supabase
        .from('parking_lots')
        .select('name, address, phone')
        .eq('id', parkingLotId)
        .maybeSingle();

      const { data: methods } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('parking_lot_id', parkingLotId)
        .eq('is_active', true)
        .neq('method_type', 'CASH');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paymentMethods: PaymentMethodInfo[] = ((methods ?? []) as any[]).map((m) => ({
        id: m.id,
        methodType: m.method_type,
        displayName: m.display_name,
        bankName: m.bank_name ?? null,
        accountHolder: m.account_holder ?? null,
        identificationNumber: m.identification_number ?? null,
        phoneNumber: m.phone_number ?? null,
        instructions: m.instructions ?? null,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lotData = lot as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionData = session as any;

      setDetails({
        linkId: linkRow.id,
        linkType: linkRow.link_type,
        paymentId: payment.id,
        amount: payment.amount,
        currencyCode: payment.currency_code,
        paymentStatus: payment.status,
        paymentMethodType: payment.method_type ?? null,
        referenceNumber: payment.reference_number ?? null,
        customerPhone: payment.customer_phone ?? null,
        customerEmail: payment.customer_email ?? null,
        plate: sessionData?.plate_snapshot ?? '---',
        vehicleType: sessionData?.vehicle_type_snapshot ?? '---',
        entryAt: sessionData?.entry_at ?? new Date().toISOString(),
        exitAt: sessionData?.exit_at ?? null,
        parkingLotName: lotData?.name ?? 'Estacionamiento',
        parkingLotAddress: lotData?.address ?? null,
        parkingLotPhone: lotData?.phone ?? null,
        paymentMethods,
      });

      if (paymentMethods.length > 0) setSelectedMethodId(paymentMethods[0].id);
      setState('ready');
    } catch {
      setState('invalid');
    }
  }, [tokenHash]);

  useEffect(() => { loadPortal(); }, [loadPortal]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      setUploadError('El archivo supera el límite de 5 MB.');
      return;
    }
    setFile(f);
    setUploadError(null);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details || !file) return;
    setUploadError(null);
    setState('uploading');
    setProgress(10);

    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const storagePath = `public/${details.paymentId}/${Date.now()}.${ext}`;
      setProgress(30);

      const { error: storageErr } = await supabase.storage
        .from('payment-receipts')
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (storageErr) throw new Error(`Error al subir: ${storageErr.message}`);
      setProgress(60);

      const { error: receiptErr } = await supabase
        .from('payment_receipts')
        .insert({
          payment_id: details.paymentId,
          storage_path: storagePath,
          original_filename: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
          status: 'RECEIVED',
        });

      if (receiptErr) throw new Error(`Error al registrar: ${receiptErr.message}`);
      setProgress(80);

      const updates: Record<string, unknown> = { status: 'UNDER_REVIEW' };
      if (selectedMethodId) updates.payment_method_id = selectedMethodId;
      if (referenceNumber.trim()) updates.reference_number = referenceNumber.trim();

      const { error: payUpdateErr } = await supabase
        .from('payments')
        .update(updates)
        .eq('id', details.paymentId);

      if (payUpdateErr) throw new Error(`Error al actualizar: ${payUpdateErr.message}`);

      await supabase
        .from('public_payment_links')
        .update({ is_active: false })
        .eq('id', details.linkId);

      setProgress(100);
      setState('success');
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.');
      setState('ready');
    }
  };

  const isUploading = state === 'uploading';

  // ── Loading ──
  if (state === 'loading') {
    return (
      <PortalShell>
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>
          <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <p>Verificando enlace de pago…</p>
        </div>
      </PortalShell>
    );
  }

  if (state === 'invalid') {
    return (
      <PortalShell>
        <StatusCard icon={<XCircle size={56} color="#ef4444" />} title="Enlace inválido"
          description="Este enlace no existe o fue revocado. Contacta al estacionamiento." color="#ef4444" />
      </PortalShell>
    );
  }

  if (state === 'expired') {
    return (
      <PortalShell>
        <StatusCard icon={<AlertTriangle size={56} color="#f59e0b" />} title="Enlace expirado"
          description="Este enlace ya venció. Pide al operador que te genere uno nuevo." color="#f59e0b" />
      </PortalShell>
    );
  }

  if (state === 'already_paid') {
    return (
      <PortalShell>
        <StatusCard icon={<CheckCircle size={56} color="#10b981" />} title="Pago ya procesado"
          description="Este pago ya fue recibido y procesado. ¡Gracias por tu pago!" color="#10b981" />
      </PortalShell>
    );
  }

  if (state === 'success') {
    return (
      <PortalShell>
        <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ width:'88px',height:'88px',borderRadius:'50%',background:'rgba(16,185,129,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1.5rem' }}>
            <CheckCircle size={52} color="#10b981" />
          </div>
          <h2 style={{ color:'#f1f5f9',fontSize:'1.6rem',fontWeight:700,marginBottom:'0.75rem' }}>¡Comprobante enviado!</h2>
          <p style={{ color:'#94a3b8',fontSize:'1rem',lineHeight:1.6,maxWidth:'380px',margin:'0 auto 2rem' }}>
            Tu comprobante fue recibido. El equipo del estacionamiento lo revisará y confirmará tu pago a la brevedad.
          </p>
          <div style={{ background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:'12px',padding:'1.25rem',maxWidth:'380px',margin:'0 auto' }}>
            <p style={{ color:'#6ee7b7',fontSize:'0.9rem',margin:0 }}>
              Puedes cerrar esta ventana tranquilamente.
            </p>
          </div>
        </div>
      </PortalShell>
    );
  }

  // ── Ready / Uploading ──
  return (
    <PortalShell>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)',borderRadius:'16px 16px 0 0',padding:'1.75rem 1.5rem',textAlign:'center' }}>
        <div style={{ width:'52px',height:'52px',borderRadius:'12px',background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 0.875rem' }}>
          <Building2 size={28} color="white" />
        </div>
        <h1 style={{ color:'white',fontSize:'1.35rem',fontWeight:700,margin:'0 0 0.25rem' }}>{details?.parkingLotName}</h1>
        {details?.parkingLotAddress && <p style={{ color:'rgba(255,255,255,0.75)',fontSize:'0.825rem',margin:0 }}>{details.parkingLotAddress}</p>}
        {details?.parkingLotPhone && <p style={{ color:'rgba(255,255,255,0.65)',fontSize:'0.8rem',marginTop:'0.25rem' }}>📞 {details.parkingLotPhone}</p>}
      </div>

      <div style={{ padding:'1.5rem' }}>

        {/* Resumen servicio */}
        <div style={{ background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem' }}>
          <h2 style={{ color:'#a5b4fc',fontSize:'0.8rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',margin:'0 0 1rem' }}>Resumen del servicio</h2>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem' }}>
            <InfoPill icon={<Car size={16}/>} label="Placa" value={details?.plate ?? '---'} highlight />
            <InfoPill icon={<Car size={16}/>} label="Tipo" value={details?.vehicleType === 'CAR' ? 'Automóvil' : 'Moto'} />
            <InfoPill icon={<Calendar size={16}/>} label="Entrada" value={formatDateTime(details?.entryAt ?? '')} />
            <InfoPill icon={<Clock size={16}/>} label="Duración" value={calcDuration(details?.entryAt ?? '', details?.exitAt ?? null)} />
          </div>
        </div>

        {/* Monto */}
        <div style={{ background:'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.08))',border:'1px solid rgba(16,185,129,0.3)',borderRadius:'12px',padding:'1.25rem',marginBottom:'1.25rem',textAlign:'center' }}>
          <p style={{ color:'#6ee7b7',fontSize:'0.8rem',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',margin:'0 0 0.5rem' }}>Total a pagar</p>
          <p style={{ color:'#f1f5f9',fontSize:'2.5rem',fontWeight:800,margin:0,letterSpacing:'-0.02em' }}>
            {formatCurrency(details?.amount ?? 0, details?.currencyCode ?? 'USD')}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Métodos de pago */}
          {details && details.paymentMethods.length > 0 && (
            <div style={{ marginBottom:'1.25rem' }}>
              <label style={{ color:'#cbd5e1',fontSize:'0.875rem',fontWeight:600,display:'block',marginBottom:'0.625rem' }}>
                Método de pago
              </label>
              <div style={{ display:'flex',flexDirection:'column',gap:'0.5rem' }}>
                {details.paymentMethods.map(m => (
                  <button key={m.id} type="button" onClick={() => setSelectedMethodId(m.id)}
                    style={{ display:'flex',alignItems:'flex-start',gap:'0.75rem',padding:'0.875rem 1rem',borderRadius:'10px',border:selectedMethodId===m.id?'2px solid #6366f1':'2px solid rgba(255,255,255,0.08)',background:selectedMethodId===m.id?'rgba(99,102,241,0.12)':'rgba(255,255,255,0.03)',cursor:'pointer',textAlign:'left',transition:'all 0.15s ease' }}>
                    <span style={{ color:selectedMethodId===m.id?'#818cf8':'#64748b',marginTop:'2px' }}>{methodIcon(m.methodType)}</span>
                    <div style={{ flex:1 }}>
                      <p style={{ color:'#f1f5f9',fontSize:'0.9rem',fontWeight:600,margin:'0 0 0.2rem' }}>{m.displayName}</p>
                      <p style={{ color:'#94a3b8',fontSize:'0.8rem',margin:0 }}>{methodLabel(m.methodType)}</p>
                      {m.bankName && (
                        <p style={{ color:'#64748b',fontSize:'0.775rem',margin:'0.25rem 0 0' }}>
                          🏦 {m.bankName}{m.accountHolder&&` · ${m.accountHolder}`}{m.identificationNumber&&` · ${m.identificationNumber}`}{m.phoneNumber&&` · ${m.phoneNumber}`}
                        </p>
                      )}
                      {m.instructions && (
                        <p style={{ color:'#818cf8',fontSize:'0.775rem',margin:'0.3rem 0 0',fontStyle:'italic' }}>ℹ️ {m.instructions}</p>
                      )}
                    </div>
                    {selectedMethodId===m.id && <CheckCircle size={18} color="#6366f1" style={{ marginTop:'2px',flexShrink:0 }} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Referencia */}
          <div style={{ marginBottom:'1.25rem' }}>
            <label htmlFor="pub-ref" style={{ color:'#cbd5e1',fontSize:'0.875rem',fontWeight:600,display:'block',marginBottom:'0.5rem' }}>
              <Hash size={14} style={{ marginRight:'0.35rem',verticalAlign:'middle' }} />
              Número de referencia <span style={{ color:'#64748b',fontWeight:400 }}>(opcional)</span>
            </label>
            <input id="pub-ref" type="text" value={referenceNumber} onChange={e=>setReferenceNumber(e.target.value)}
              placeholder="Ej: 1234567890" disabled={isUploading}
              style={{ width:'100%',padding:'0.75rem 1rem',borderRadius:'10px',border:'1px solid rgba(255,255,255,0.12)',background:'rgba(255,255,255,0.05)',color:'#f1f5f9',fontSize:'0.9rem',outline:'none',boxSizing:'border-box' }} />
          </div>

          {/* Comprobante */}
          <div style={{ marginBottom:'1.5rem' }}>
            <label style={{ color:'#cbd5e1',fontSize:'0.875rem',fontWeight:600,display:'block',marginBottom:'0.5rem' }}>
              <ImageIcon size={14} style={{ marginRight:'0.35rem',verticalAlign:'middle' }} />
              Comprobante de pago <span style={{ color:'#ef4444' }}>*</span>
            </label>
            <label htmlFor="pub-receipt-file" style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'0.5rem',padding:'1.5rem',borderRadius:'12px',border:`2px dashed ${file?'#6366f1':'rgba(255,255,255,0.15)'}`,background:file?'rgba(99,102,241,0.06)':'rgba(255,255,255,0.02)',cursor:isUploading?'not-allowed':'pointer',transition:'all 0.15s ease',textAlign:'center' }}>
              {previewUrl && file?.type.startsWith('image/') ? (
                <img src={previewUrl} alt="Vista previa" style={{ maxWidth:'100%',maxHeight:'180px',borderRadius:'8px',objectFit:'contain' }} />
              ) : file ? (
                <><FileText size={36} color="#6366f1" /><span style={{ color:'#a5b4fc',fontSize:'0.85rem',fontWeight:600 }}>{file.name}</span></>
              ) : (
                <>
                  <Upload size={32} color="#475569" />
                  <span style={{ color:'#64748b',fontSize:'0.875rem' }}>Toca para seleccionar imagen o PDF</span>
                  <span style={{ color:'#475569',fontSize:'0.775rem' }}>JPG, PNG, PDF · Máx. 5 MB</span>
                </>
              )}
              <input id="pub-receipt-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange} disabled={isUploading} style={{ display:'none' }} />
            </label>
            {file && (
              <button type="button" onClick={()=>{setFile(null);setPreviewUrl(null);}} disabled={isUploading}
                style={{ marginTop:'0.5rem',background:'none',border:'none',color:'#ef4444',fontSize:'0.8rem',cursor:'pointer',padding:'0.25rem 0' }}>
                ✕ Eliminar archivo
              </button>
            )}
          </div>

          {/* Progreso */}
          {isUploading && (
            <div style={{ marginBottom:'1rem' }}>
              <div style={{ height:'6px',borderRadius:'3px',background:'rgba(255,255,255,0.08)',overflow:'hidden' }}>
                <div style={{ height:'100%',width:`${progress}%`,background:'linear-gradient(90deg,#6366f1,#8b5cf6)',borderRadius:'3px',transition:'width 0.3s ease' }} />
              </div>
              <p style={{ color:'#6366f1',fontSize:'0.8rem',marginTop:'0.5rem',textAlign:'center' }}>Subiendo comprobante…</p>
            </div>
          )}

          {/* Error */}
          {uploadError && (
            <div style={{ background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:'10px',padding:'0.875rem 1rem',marginBottom:'1rem',display:'flex',alignItems:'flex-start',gap:'0.625rem' }}>
              <AlertTriangle size={16} color="#ef4444" style={{ flexShrink:0,marginTop:'1px' }} />
              <p style={{ color:'#fca5a5',fontSize:'0.85rem',margin:0 }}>{uploadError}</p>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={isUploading||!file}
            style={{ width:'100%',padding:'1rem',borderRadius:'12px',border:'none',background:isUploading||!file?'rgba(255,255,255,0.06)':'linear-gradient(135deg,#6366f1,#8b5cf6)',color:isUploading||!file?'#475569':'white',fontSize:'1rem',fontWeight:700,cursor:isUploading||!file?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.625rem',transition:'all 0.2s ease',boxShadow:isUploading||!file?'none':'0 4px 20px rgba(99,102,241,0.35)' }}>
            {isUploading ? (
              <><Loader2 size={18} style={{ animation:'spin 1s linear infinite' }} />Enviando…</>
            ) : (
              <><Send size={18} />Enviar comprobante<ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div style={{ marginTop:'1.5rem',paddingTop:'1rem',borderTop:'1px solid rgba(255,255,255,0.06)',textAlign:'center' }}>
          <p style={{ color:'#334155',fontSize:'0.775rem',margin:0 }}>
            Powered by <strong style={{ color:'#475569' }}>ParkingVE</strong>
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </PortalShell>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const PortalShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ minHeight:'100vh',background:'radial-gradient(ellipse at 50% 0%,rgba(99,102,241,0.12) 0%,transparent 60%),#0f172a',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:'1.5rem 1rem 3rem',fontFamily:"'Inter',system-ui,sans-serif" }}>
    <div style={{ width:'100%',maxWidth:'440px',background:'#1e293b',borderRadius:'16px',border:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 25px 60px rgba(0,0,0,0.6)',overflow:'hidden' }}>
      {children}
    </div>
  </div>
);

interface StatusCardProps { icon: React.ReactNode; title: string; description: string; color: string; }
const StatusCard: React.FC<StatusCardProps> = ({ icon, title, description, color }) => (
  <div style={{ padding:'3rem 2rem',textAlign:'center' }}>
    <div style={{ width:'88px',height:'88px',borderRadius:'50%',background:`${color}18`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 1.5rem' }}>{icon}</div>
    <h2 style={{ color:'#f1f5f9',fontSize:'1.4rem',fontWeight:700,marginBottom:'0.75rem' }}>{title}</h2>
    <p style={{ color:'#94a3b8',fontSize:'0.95rem',lineHeight:1.6,maxWidth:'320px',margin:'0 auto' }}>{description}</p>
  </div>
);

interface InfoPillProps { icon: React.ReactNode; label: string; value: string; highlight?: boolean; }
const InfoPill: React.FC<InfoPillProps> = ({ icon, label, value, highlight }) => (
  <div style={{ background:'rgba(255,255,255,0.04)',borderRadius:'8px',padding:'0.625rem 0.75rem' }}>
    <div style={{ display:'flex',alignItems:'center',gap:'0.375rem',color:'#64748b',fontSize:'0.75rem',marginBottom:'0.25rem' }}>{icon}{label}</div>
    <p style={{ color:highlight?'#a5b4fc':'#cbd5e1',fontSize:highlight?'1.05rem':'0.875rem',fontWeight:highlight?700:600,margin:0 }}>{value}</p>
  </div>
);

