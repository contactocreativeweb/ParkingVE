import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Receipt,
  Search,
  Printer,
  Share2,
  CheckCircle2,
  Car,
  Clock,
  Calendar,
  MapPin,
  User,
  DollarSign,
  RefreshCw,
  AlertCircle,
  FileText,
  Layers,
} from 'lucide-react';
import type {
  Receipt as ReceiptType,
  ParkingSession,
  Payment,
  Customer,
  Vehicle,
  ParkingLot,
  SessionAdditionalService,
} from '../../types/database';

interface FullReceipt extends ReceiptType {
  parking_sessions?: (ParkingSession & {
    customers?: Customer | null;
    vehicles?: Vehicle | null;
    session_additional_services?: SessionAdditionalService[];
  }) | null;
  payments?: Payment | null;
  parking_lots?: ParkingLot | null;
}

interface ReceiptViewProps {
  initialReceiptId?: string | null;
  initialPlate?: string | null;
}

export const ReceiptView: React.FC<ReceiptViewProps> = ({ initialReceiptId, initialPlate }) => {
  const { currentParkingLot, organization } = useAuth();
  const [searchTerm, setSearchTerm] = useState(initialPlate || '');
  const [receipt, setReceipt] = useState<FullReceipt | null>(null);
  const [recentReceipts, setRecentReceipts] = useState<FullReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const SELECT_CLAUSE = `*, parking_sessions(*, customers(*), session_additional_services(*)), payments(*), parking_lots(*)`;

  const loadRecentReceipts = async () => {
    if (!currentParkingLot) return;
    setLoadingRecent(true);
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select(SELECT_CLAUSE)
        .eq('parking_lot_id', currentParkingLot.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setRecentReceipts((data || []) as FullReceipt[]);
    } catch (err: unknown) {
      console.error('Error loading recent receipts:', err);
    } finally {
      setLoadingRecent(false);
    }
  };

  const loadReceiptById = async (id: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select(SELECT_CLAUSE)
        .eq('id', id)
        .single();
      if (error) throw error;
      setReceipt(data as FullReceipt);
    } catch (err: unknown) {
      setErrorMsg('No se pudo cargar el recibo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParkingLot) return;
    const term = searchTerm.trim();
    if (!term) return;
    setLoading(true);
    setErrorMsg(null);
    setReceipt(null);
    try {
      const isReceiptNum = term.toUpperCase().startsWith('REC-') || /^\d+$/.test(term);
      let results: FullReceipt[] = [];

      if (isReceiptNum) {
        const numVal = parseInt(term.replace(/^REC-/i, ''), 10);
        if (!isNaN(numVal)) {
          const { data, error } = await supabase
            .from('receipts')
            .select(SELECT_CLAUSE)
            .eq('parking_lot_id', currentParkingLot.id)
            .eq('receipt_number', numVal)
            .limit(1);
          if (error) throw error;
          results = (data || []) as FullReceipt[];
        }
      } else {
        const plate = term.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const { data, error } = await supabase
          .from('receipts')
          .select(SELECT_CLAUSE)
          .eq('parking_lot_id', currentParkingLot.id)
          .eq('plate_snapshot', plate)
          .order('created_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        results = (data || []) as FullReceipt[];
      }

      if (results.length === 0) {
        setErrorMsg(`No se encontró ningún recibo para "${term}".`);
      } else {
        setReceipt(results[0]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al buscar recibo.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecentReceipts();
    if (initialReceiptId) loadReceiptById(initialReceiptId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParkingLot?.id]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return;
    win.document.write(`<html><head><title>Recibo ParkingVE</title>
<style>body{font-family:'Courier New',monospace;padding:24px;background:#fff;color:#000;}</style>
</head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleShare = async () => {
    if (!receipt) return;
    const text = [
      `🅿️ ParkingVE — Recibo #${String(receipt.receipt_number).padStart(5, '0')}`,
      `Placa: ${receipt.plate_snapshot}`,
      `Monto: $${Number(receipt.total_amount).toFixed(2)} USD`,
      `Fecha: ${new Date(receipt.created_at).toLocaleString()}`,
    ].join('\n');
    if (navigator.share) {
      await navigator.share({ title: 'Recibo ParkingVE', text });
    } else {
      await navigator.clipboard.writeText(text);
      alert('Recibo copiado al portapapeles.');
    }
  };

  const formatDuration = (entryIso: string, exitIso?: string | null): string => {
    const diffMs = (exitIso ? new Date(exitIso) : new Date()).getTime() - new Date(entryIso).getTime();
    const h = Math.floor(diffMs / 3_600_000);
    const m = Math.floor((diffMs % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  };

  if (!currentParkingLot) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}><h3>Selecciona un estacionamiento</h3></div>;
  }

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-operator">FASE 14: RECIBO DE PAGO</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Recibos de Pago</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Consulta, imprime y comparte comprobantes oficiales de cobro aprobados.
          </p>
        </div>
        <button type="button" onClick={loadRecentReceipts} disabled={loadingRecent} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {/* Buscador */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <div style={{
          flex: 1, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1rem',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text" className="input-field"
            style={{ border: 'none', padding: '0.2rem 0', backgroundColor: 'transparent', boxShadow: 'none' }}
            placeholder="Buscar por placa (ABC123) o Nº de recibo (REC-00001)…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading || !searchTerm.trim()}>
          <Search size={16} /> Buscar
        </button>
      </form>

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} /><span>{errorMsg}</span>
        </div>
      )}

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando recibo…</div>}

      {receipt && !loading && (
        <ReceiptCard
          receipt={receipt}
          orgName={organization?.name || 'ParkingVE'}
          printRef={printRef}
          onPrint={handlePrint}
          onShare={handleShare}
          formatDuration={formatDuration}
          onBack={() => setReceipt(null)}
        />
      )}

      {/* Recibos Recientes */}
      {!receipt && !loading && (
        <div style={{
          backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-md)', overflow: 'hidden',
        }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Receipt size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Recibos Recientes</span>
          </div>
          {loadingRecent ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando historial…</div>
          ) : recentReceipts.length === 0 ? (
            <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
              <FileText size={44} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.1rem' }}>Sin recibos emitidos aún</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Los recibos se generan al aprobar un pago en Revisión (Fase 13).
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentReceipts.map((r, idx) => (
                <div key={r.id} onClick={() => setReceipt(r)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1rem 1.5rem',
                    borderBottom: idx < recentReceipts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    cursor: 'pointer', transition: 'background-color 0.12s ease', flexWrap: 'wrap', gap: '0.75rem',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-input)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Receipt size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
                        REC-{String(r.receipt_number).padStart(5, '0')}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {r.plate_snapshot} • {r.vehicle_type_snapshot === 'CAR' ? 'Carro' : 'Moto'}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)', color: 'var(--status-success)' }}>
                      ${Number(r.total_amount).toFixed(2)} USD
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── ReceiptCard ── */
interface ReceiptCardProps {
  receipt: FullReceipt;
  orgName: string;
  printRef: React.RefObject<HTMLDivElement | null>;
  onPrint: () => void;
  onShare: () => void;
  onBack: () => void;
  formatDuration: (entry: string, exit?: string | null) => string;
}

const ReceiptCard: React.FC<ReceiptCardProps> = ({ receipt, orgName, printRef, onPrint, onShare, onBack, formatDuration }) => {
  const sess = receipt.parking_sessions;
  const cust = sess?.customers;
  const services: SessionAdditionalService[] = sess?.session_additional_services || [];
  const lot = receipt.parking_lots;
  const subtotal = Number(receipt.subtotal ?? 0);
  const servicesTotal = services.reduce((sum, s) => sum + Number(s.total_price ?? 0), 0);
  const total = Number(receipt.total_amount ?? 0);

  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--status-success)',
      boxShadow: '0 0 0 1px rgba(16,185,129,0.15), var(--shadow-lg)', overflow: 'hidden',
    }}>
      {/* Barra de acciones */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(16,185,129,0.06)', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={20} color="#10b981" />
          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#10b981' }}>
            Pago Aprobado — REC-{String(receipt.receipt_number).padStart(5, '0')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={onBack} className="btn btn-ghost" style={{ fontSize: '0.85rem' }}>
            ← Volver
          </button>
          <button type="button" onClick={onShare} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            <Share2 size={15} /> Compartir
          </button>
          <button type="button" onClick={onPrint} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </div>

      {/* Contenido imprimible */}
      <div ref={printRef} style={{ padding: '2rem' }}>
        {/* Cabecera */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem',
          }}>
            <Receipt size={28} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.2rem' }}>{orgName}</h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <MapPin size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            {lot?.name || ''}{lot?.address ? ` — ${lot.address}` : ''}
          </div>
          <div style={{
            display: 'inline-block', marginTop: '0.75rem', padding: '0.35rem 1rem',
            backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: '999px',
            color: '#10b981', fontWeight: 800, fontSize: '1.1rem', fontFamily: 'var(--font-mono)',
          }}>
            RECIBO Nº {String(receipt.receipt_number).padStart(5, '0')}
          </div>
        </div>

        <div style={{ borderTop: '1px dashed var(--border-subtle)', margin: '0 0 1.5rem' }} />

        {/* Grid info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <InfoBlock icon={<Car size={16} />} label="Vehículo">
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.5rem' }}>{receipt.plate_snapshot}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {receipt.vehicle_type_snapshot === 'CAR' ? 'Automóvil' : 'Motocicleta'}
            </div>
          </InfoBlock>

          <InfoBlock icon={<User size={16} />} label="Cliente">
            <div style={{ fontWeight: 700 }}>
              {cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : 'Cliente Ocasional'}
            </div>
            {cust?.phone && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cust.phone}</div>}
          </InfoBlock>

          <InfoBlock icon={<Calendar size={16} />} label="Entrada">
            <div style={{ fontWeight: 700 }}>
              {receipt.entry_at ? new Date(receipt.entry_at).toLocaleString() : '—'}
            </div>
          </InfoBlock>

          <InfoBlock icon={<Clock size={16} />} label="Duración">
            <div style={{ fontWeight: 700 }}>
              {receipt.exit_at ? new Date(receipt.exit_at).toLocaleString() : '—'}
            </div>
            {receipt.entry_at && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Tiempo: {formatDuration(receipt.entry_at, receipt.exit_at)}
              </div>
            )}
          </InfoBlock>
        </div>

        <div style={{ borderTop: '1px dashed var(--border-subtle)', margin: '0 0 1.25rem' }} />

        {/* Desglose */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem',
            color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase',
          }}>
            <DollarSign size={14} /> Desglose de Cobro
          </div>

          <LineItem label={`Tarifa Base (${receipt.vehicle_type_snapshot === 'CAR' ? 'Carro' : 'Moto'})`} amount={subtotal} />

          {sess?.lost_ticket && (
            <LineItem label="Ticket Extraviado" amount={Number(sess.lost_ticket_fee ?? 0)} highlight />
          )}

          {services.length > 0 && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                margin: '0.75rem 0 0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600,
              }}>
                <Layers size={13} /> Servicios Adicionales
              </div>
              {services.map((s) => (
                <LineItem
                  key={s.id}
                  label={`${s.service_name_snapshot}${s.quantity > 1 ? ` x${s.quantity}` : ''}`}
                  amount={Number(s.total_price ?? 0)}
                />
              ))}
            </>
          )}

          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>TOTAL</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '1.5rem', color: 'var(--status-success)' }}>
                ${total.toFixed(2)} {receipt.currency_code}
              </span>
            </div>
            {servicesTotal > 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '0.15rem' }}>
                Base ${subtotal.toFixed(2)} + Servicios ${servicesTotal.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        <div style={{ borderTop: '1px dashed var(--border-subtle)', margin: '0 0 1rem' }} />

        {/* Pie */}
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.6 }}>
          <div>Emitido el {new Date(receipt.created_at).toLocaleString()}</div>
          <div>Método: {receipt.payments ? paymentMethodLabel(receipt.payments.method_type) : receipt.payment_method ? paymentMethodLabel(receipt.payment_method) : '—'}</div>
          {receipt.payments?.reference_number && <div>Referencia: {receipt.payments.reference_number}</div>}
          <div style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            ¡Gracias por su visita! — ParkingVE
          </div>
        </div>
      </div>
    </div>
  );
};

function paymentMethodLabel(method: string): string {
  switch (method) {
    case 'CASH': return 'Efectivo';
    case 'POS': return 'Punto de Venta (POS)';
    case 'MOBILE_PAYMENT': return 'Pago Móvil';
    case 'BANK_TRANSFER': return 'Transferencia Bancaria';
    default: return method;
  }
}

const InfoBlock: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.4rem',
      color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700,
      textTransform: 'uppercase', marginBottom: '0.5rem',
    }}>
      {icon} {label}
    </div>
    {children}
  </div>
);

const LineItem: React.FC<{ label: string; amount: number; highlight?: boolean }> = ({ label, amount, highlight }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.35rem 0',
    color: highlight ? '#fbbf24' : 'var(--text-secondary)', fontSize: '0.9rem',
  }}>
    <span>{label}</span>
    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: highlight ? '#fbbf24' : 'var(--text-primary)' }}>
      ${amount.toFixed(2)}
    </span>
  </div>
);
