import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Building, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  QrCode, 
  Sparkles,
  Mail
} from 'lucide-react';
import { logAuditEvent } from '../../lib/audit';
import type { 
  ParkingSession, 
  PaymentMethod, 
  PaymentMethodType, 
  Customer 
} from '../../types/database';

interface PaymentViewProps {
  initialSession?: ParkingSession | null;
  onPaymentRegistered?: (paymentId: string, publicToken?: string) => void;
}

export const PaymentView: React.FC<PaymentViewProps> = ({ initialSession, onPaymentRegistered }) => {
  const { currentParkingLot, organization, user } = useAuth();

  const [activePendingSessions, setActivePendingSessions] = useState<ParkingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ParkingSession | null>(initialSession || null);
  const [sessionCustomer, setSessionCustomer] = useState<Customer | null>(null);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodType, setSelectedMethodType] = useState<PaymentMethodType>('MOBILE_PAYMENT');
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');

  // Datos del pago
  const [referenceNumber, setReferenceNumber] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Copiado al portapapeles
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Link público generado
  const [generatedPublicLink, setGeneratedPublicLink] = useState<{
    token: string;
    url: string;
  } | null>(null);

  // Estados de carga y acción
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currency = currentParkingLot?.currency_code || 'USD';

  // 1. Cargar sesiones pendientes de pago o seleccionar la provista
  const loadPendingSessions = async () => {
    if (!currentParkingLot) return;
    try {
      const { data } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id)
        .in('status', ['PAYMENT_PENDING', 'ACTIVE'])
        .order('entry_at', { ascending: false });

      setActivePendingSessions((data || []) as ParkingSession[]);

      if (!selectedSession && data && data.length > 0) {
        setSelectedSession(data[0] as ParkingSession);
      }
    } catch (err: any) {
      console.warn('Error loading pending sessions:', err.message);
    }
  };

  useEffect(() => {
    loadPendingSessions();
  }, [currentParkingLot?.id]);

  // Sincronizar datos del cliente al cambiar la sesión
  useEffect(() => {
    if (selectedSession) {
      setCustomerEmail(selectedSession.customer_email || '');
      setCustomerPhone(selectedSession.customer_phone || '');
      setReferenceNumber('');
      setGeneratedPublicLink(null);

      if (selectedSession.customer_id) {
        supabase
          .from('customers')
          .select('*')
          .eq('id', selectedSession.customer_id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) {
              setSessionCustomer(data as Customer);
              if (!customerEmail && data.email) setCustomerEmail(data.email);
              if (!customerPhone && data.phone) setCustomerPhone(data.phone);
            }
          });
      } else {
        setSessionCustomer(null);
      }
    }
  }, [selectedSession]);

  // 2. Cargar métodos de pago configurados en el estacionamiento
  const loadPaymentMethods = async () => {
    if (!currentParkingLot) return;
    try {
      const { data } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id)
        .eq('is_active', true);

      const list = (data || []) as PaymentMethod[];
      setPaymentMethods(list);

      // Auto-seleccionar primer método del tipo activo
      const match = list.find((m) => m.method_type === selectedMethodType);
      if (match) setSelectedMethodId(match.id);
      else if (list.length > 0) {
        setSelectedMethodId(list[0].id);
        setSelectedMethodType(list[0].method_type);
      }
    } catch (err: any) {
      console.warn('Error loading payment methods:', err.message);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, [currentParkingLot?.id]);

  // Sincronizar selectedMethodId al cambiar el tipo de método
  useEffect(() => {
    const match = paymentMethods.find((m) => m.method_type === selectedMethodType);
    if (match) setSelectedMethodId(match.id);
  }, [selectedMethodType, paymentMethods]);

  // Inicializar métodos por defecto si no existen
  const handleSeedDefaultPaymentMethods = async () => {
    if (!currentParkingLot) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const defaults = [
        {
          parking_lot_id: currentParkingLot.id,
          method_type: 'MOBILE_PAYMENT' as PaymentMethodType,
          display_name: 'Pago Móvil Banesco',
          bank_name: '0134 - Banesco',
          account_holder: 'Estacionamiento C.A.',
          identification_number: 'J-12345678-9',
          phone_number: '04121234567',
          instructions: 'Enviar capture o número de referencia tras realizar el pago.',
          is_active: true,
        },
        {
          parking_lot_id: currentParkingLot.id,
          method_type: 'POS' as PaymentMethodType,
          display_name: 'Punto de Venta Taquilla',
          instructions: 'Pago con tarjeta de débito o crédito en taquilla física.',
          is_active: true,
        },
        {
          parking_lot_id: currentParkingLot.id,
          method_type: 'CASH' as PaymentMethodType,
          display_name: 'Efectivo USD',
          instructions: 'Pago directo en billetes en buen estado.',
          is_active: true,
        },
        {
          parking_lot_id: currentParkingLot.id,
          method_type: 'BANK_TRANSFER' as PaymentMethodType,
          display_name: 'Transferencia Banesco / Mercantil',
          bank_name: 'Banesco Banco Universal',
          account_holder: 'Estacionamiento C.A.',
          identification_number: 'J-12345678-9',
          instructions: 'Transferencias del mismo banco inmediatas.',
          is_active: true,
        },
      ];

      const { error } = await supabase.from('payment_methods').insert(defaults);
      if (error) throw error;
      await loadPaymentMethods();
      setSuccessMsg('Métodos de pago iniciales configurados.');
    } catch (err: any) {
      console.error('Error seeding payment methods:', err);
      setErrorMsg(err.message || 'Error al configurar métodos de pago');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Registrar el Pago (Fase 11)
  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !currentParkingLot || !user) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const amount = Number(selectedSession.total_amount) || 0;
      const isInstantTaquilla = selectedMethodType === 'CASH' || selectedMethodType === 'POS';
      const initialStatus = isInstantTaquilla ? 'APPROVED' : 'RECEIPT_REQUIRED';

      // 1. Guardar o actualizar email/teléfono en la sesión si se especificaron
      if (customerEmail || customerPhone) {
        await supabase
          .from('parking_sessions')
          .update({
            customer_email: customerEmail.trim() || null,
            customer_phone: customerPhone.trim() || null,
            status: 'PAYMENT_PENDING',
          })
          .eq('id', selectedSession.id);
      }

      // 2. Insertar registro en public.payments
      const { data: paymentData, error: payErr } = await supabase
        .from('payments')
        .insert({
          parking_lot_id: currentParkingLot.id,
          session_id: selectedSession.id,
          payment_method_id: selectedMethodId || null,
          method_type: selectedMethodType,
          amount: amount,
          currency_code: currency,
          status: initialStatus,
          reference_number: referenceNumber.trim() || null,
          customer_email: customerEmail.trim() || null,
          customer_phone: customerPhone.trim() || null,
          paid_at: isInstantTaquilla ? new Date().toISOString() : null,
          reviewed_at: isInstantTaquilla ? new Date().toISOString() : null,
          reviewed_by: isInstantTaquilla ? user.id : null,
          notes: paymentNotes.trim() || null,
        })
        .select()
        .single();

      if (payErr) throw payErr;

      if (organization?.id && currentParkingLot?.id && user?.id) {
        logAuditEvent({
          organizationId: organization.id,
          parkingLotId: currentParkingLot.id,
          userId: user.id,
          action: 'INSERT',
          entityType: 'payments',
          entityId: paymentData.id,
          metadata: {
            description: `Pago registrado: $${amount.toFixed(2)} USD (${selectedMethodType}) - ${initialStatus}`,
            amount,
            method_type: selectedMethodType,
            status: initialStatus,
            session_id: selectedSession.id,
          },
        });
      }

      // 3. Crear enlace de pago público con token aleatorio hash (Reglas 25 y 45)
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      const tokenHash = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

      const { error: linkErr } = await supabase
        .from('public_payment_links')
        .insert({
          parking_lot_id: currentParkingLot.id,
          session_id: selectedSession.id,
          payment_id: paymentData.id,
          link_type: 'PAYMENT',
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
          is_active: true,
        })
        .select()
        .single();

      if (linkErr) {
        console.warn('Could not generate public payment link:', linkErr.message);
      }

      const publicUrl = `${window.location.origin}/pay/${tokenHash}`;
      setGeneratedPublicLink({
        token: tokenHash,
        url: publicUrl,
      });

      if (isInstantTaquilla) {
        setSuccessMsg(`Pago en ${selectedMethodType === 'CASH' ? 'Efectivo' : 'POS'} de $${amount.toFixed(2)} USD aprobado exitosamente en taquilla.`);
      } else {
        setSuccessMsg(`Pago de $${amount.toFixed(2)} registrado. Estado: PENDIENTE DE COMPROBANTE.`);
      }

      if (onPaymentRegistered) {
        onPaymentRegistered(paymentData.id, tokenHash);
      }

    } catch (err: any) {
      console.error('Error registering payment:', err);
      setErrorMsg(err.message || 'Error al procesar el pago');
    } finally {
      setSubmitting(false);
    }
  };

  const activeMethod = paymentMethods.find((m) => m.id === selectedMethodId) || paymentMethods.find((m) => m.method_type === selectedMethodType);

  if (!currentParkingLot) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <h3>Selecciona un estacionamiento para gestionar pagos</h3>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <span className="badge badge-operator" style={{ marginBottom: '0.4rem' }}>
          FASE 11: PAGO & COBRO
        </span>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>
          Procesamiento de Pago
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Selecciona el método de pago, visualiza los datos bancarios y emite el comprobante o enlace público.
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

      {/* Selector de Sesión Pendiente si hay más de una */}
      {activePendingSessions.length > 1 && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Vehículos listos para pagar:</span>
          {activePendingSessions.map((sess) => (
            <button
              key={sess.id}
              type="button"
              onClick={() => setSelectedSession(sess)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                border: sess.id === selectedSession?.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                backgroundColor: sess.id === selectedSession?.id ? 'var(--bg-badge)' : 'var(--bg-input)',
                color: sess.id === selectedSession?.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              {sess.plate_snapshot} (${Number(sess.total_amount).toFixed(2)})
            </button>
          ))}
        </div>
      )}

      {selectedSession ? (
        <form onSubmit={handleRegisterPayment} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Card Principal: TOTAL A PAGAR (Sección 59) */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)',
            padding: '2rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'linear-gradient(90deg, #6366f1, #06b6d4, #10b981)',
            }} />

            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              TOTAL A PAGAR
            </span>

            <div style={{
              fontSize: '3.25rem',
              fontWeight: 900,
              color: '#fff',
              fontFamily: 'var(--font-mono)',
              lineHeight: 1.1,
              marginTop: '0.4rem',
              marginBottom: '0.4rem',
            }}>
              ${Number(selectedSession.total_amount).toFixed(2)}{' '}
              <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {selectedSession.currency_code || currency}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: '1.1rem',
                backgroundColor: 'var(--bg-input)',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
              }}>
                Placa: {selectedSession.plate_snapshot}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Cliente: {sessionCustomer ? `${sessionCustomer.first_name || ''} ${sessionCustomer.last_name || ''}`.trim() : 'Cliente Ocasional'}
              </span>
            </div>
          </div>

          {/* Botones de Selección de Métodos de Pago (Sección 59) */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.75rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                Selecciona Método de Pago
              </label>

              {paymentMethods.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedDefaultPaymentMethods}
                  disabled={loading}
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}
                >
                  <Sparkles size={14} /> Cargar métodos sugeridos
                </button>
              )}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.75rem',
            }}>
              {/* Opción 1: Pago Móvil */}
              <button
                type="button"
                onClick={() => setSelectedMethodType('MOBILE_PAYMENT')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: selectedMethodType === 'MOBILE_PAYMENT' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: selectedMethodType === 'MOBILE_PAYMENT' ? 'var(--bg-badge)' : 'var(--bg-input)',
                  color: selectedMethodType === 'MOBILE_PAYMENT' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Smartphone size={24} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Pago Móvil</span>
              </button>

              {/* Opción 2: Punto de Venta */}
              <button
                type="button"
                onClick={() => setSelectedMethodType('POS')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: selectedMethodType === 'POS' ? '2px solid var(--accent-secondary)' : '1px solid var(--border-subtle)',
                  backgroundColor: selectedMethodType === 'POS' ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-input)',
                  color: selectedMethodType === 'POS' ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <CreditCard size={24} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Punto de Venta</span>
              </button>

              {/* Opción 3: Efectivo */}
              <button
                type="button"
                onClick={() => setSelectedMethodType('CASH')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: selectedMethodType === 'CASH' ? '2px solid var(--status-success)' : '1px solid var(--border-subtle)',
                  backgroundColor: selectedMethodType === 'CASH' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-input)',
                  color: selectedMethodType === 'CASH' ? 'var(--status-success)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Banknote size={24} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Efectivo</span>
              </button>

              {/* Opción 4: Transferencia */}
              <button
                type="button"
                onClick={() => setSelectedMethodType('BANK_TRANSFER')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '1rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  border: selectedMethodType === 'BANK_TRANSFER' ? '2px solid #fbbf24' : '1px solid var(--border-subtle)',
                  backgroundColor: selectedMethodType === 'BANK_TRANSFER' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-input)',
                  color: selectedMethodType === 'BANK_TRANSFER' ? '#fbbf24' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Building size={24} />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Transferencia</span>
              </button>
            </div>

            {/* SECCIÓN PAGO MÓVIL: Datos requeridos en Sección 59 (Banco, Teléfono, Cédula/RIF, Titular, Monto) */}
            {selectedMethodType === 'MOBILE_PAYMENT' && (
              <div style={{
                marginTop: '0.75rem',
                padding: '1.5rem',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                    Datos para Pago Móvil
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Haz clic en copiar para compartir con el cliente
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>BANCO</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {activeMethod?.bank_name || '0134 - Banesco'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeMethod?.bank_name || 'Banesco', 'banco')}
                      className="btn btn-ghost"
                      style={{ padding: '0.35rem' }}
                    >
                      {copiedField === 'banco' ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} />}
                    </button>
                  </div>

                  <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>TELÉFONO</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {activeMethod?.phone_number || '04121234567'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeMethod?.phone_number || '04121234567', 'telefono')}
                      className="btn btn-ghost"
                      style={{ padding: '0.35rem' }}
                    >
                      {copiedField === 'telefono' ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} />}
                    </button>
                  </div>

                  <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>CÉDULA / RIF</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                        {activeMethod?.identification_number || 'J-12345678-9'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeMethod?.identification_number || 'J-12345678-9', 'rif')}
                      className="btn btn-ghost"
                      style={{ padding: '0.35rem' }}
                    >
                      {copiedField === 'rif' ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} />}
                    </button>
                  </div>

                  <div style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>TITULAR</div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {activeMethod?.account_holder || currentParkingLot.name}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(activeMethod?.account_holder || currentParkingLot.name, 'titular')}
                      className="btn btn-ghost"
                      style={{ padding: '0.35rem' }}
                    >
                      {copiedField === 'titular' ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                {/* Monto exacto */}
                <div style={{
                  padding: '1rem',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--accent-primary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                      MONTO EXACTO A TRANSFERIR
                    </span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.5rem', color: '#fff' }}>
                      ${Number(selectedSession.total_amount).toFixed(2)} {currency}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(Number(selectedSession.total_amount).toFixed(2), 'monto')}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.85rem' }}
                  >
                    {copiedField === 'monto' ? <Check size={16} color="var(--status-success)" /> : <Copy size={16} />} Copiar Monto
                  </button>
                </div>

              </div>
            )}

            {/* SECCIÓN TRANSFERENCIA */}
            {selectedMethodType === 'BANK_TRANSFER' && activeMethod && (
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.9rem',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Datos de Cuenta Bancaria
                </div>
                <div>Banco: <strong>{activeMethod.bank_name || 'Banesco'}</strong></div>
                <div>Titular: <strong>{activeMethod.account_holder || currentParkingLot.name}</strong></div>
                <div>RIF: <strong>{activeMethod.identification_number || 'J-12345678-9'}</strong></div>
                {activeMethod.instructions && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    {activeMethod.instructions}
                  </div>
                )}
              </div>
            )}

            {/* Entrada de Referencia (Para Pago Móvil, POS, Transferencia) */}
            {selectedMethodType !== 'CASH' && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Número de Referencia Bancaria / Lote</label>
                <input
                  type="text"
                  required={selectedMethodType === 'POS'}
                  className="input-field"
                  placeholder="Ej. 123456 (últimos dígitos del comprobante)"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>
            )}

            {/* Datos del Cliente y Email para Envío de Enlace / Recibo (Sección 27) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={14} color="var(--status-info)" /> Correo del Cliente (Para envío de link)
                </label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="cliente@ejemplo.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Teléfono WhatsApp / SMS</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="04121234567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Notas del Pago (Opcional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Recibido en taquilla, vuelto entregado, etc."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>

            {/* Botón de Registro de Pago */}
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{
                padding: '1.15rem',
                fontSize: '1.15rem',
                fontWeight: 800,
                marginTop: '0.5rem',
              }}
            >
              {submitting ? 'Registrando pago...' : (
                <>
                  <CheckCircle2 size={20} /> CONFIRMAR Y REGISTRAR PAGO
                </>
              )}
            </button>

          </div>

          {/* Enlace Público y QR Generado (Reglas 25 y 45) */}
          {generatedPublicLink && (
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--accent-primary)',
              boxShadow: 'var(--shadow-glow)',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-badge)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <QrCode size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Enlace Público de Pago para el Cliente</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    El cliente no requiere cuenta ParkingVE. Puede abrir el link seguro con token hash para adjuntar su comprobante.
                  </p>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--bg-input)',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}>
                <input
                  type="text"
                  readOnly
                  value={generatedPublicLink.url}
                  style={{
                    flex: 1,
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedPublicLink.url, 'link')}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                >
                  {copiedField === 'link' ? <Check size={14} color="var(--status-success)" /> : <Copy size={14} />} Copiar Link
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                  Listo para pasar a la Fase 12 (Recepción y subida de comprobante)
                </span>
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
          <CreditCard size={44} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
          <h3>No hay operaciones pendientes de cobro</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Selecciona un vehículo en la pestaña de Salida para calcular su tarifa y proceder al pago.
          </p>
        </div>
      )}

    </div>
  );
};
