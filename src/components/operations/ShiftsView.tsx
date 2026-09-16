import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Clock,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Banknote,
  CreditCard,
  Smartphone,
  Building,
  LogIn,
  LogOut,
  TrendingUp,
} from 'lucide-react';
import { logAuditEvent } from '../../lib/audit';
import type { Shift } from '../../types/database';

interface ShiftWithTotals extends Shift {
  cash_total?: number;
  pos_total?: number;
  mobile_total?: number;
  transfer_total?: number;
  operations_count?: number;
}

export const ShiftsView: React.FC = () => {
  const { currentParkingLot, organization, user, role } = useAuth();

  const [activeShift, setActiveShift] = useState<ShiftWithTotals | null>(null);
  const [recentShifts, setRecentShifts] = useState<ShiftWithTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Apertura de turno
  const [openingCash, setOpeningCash] = useState('');

  // Cierre de turno
  const [declaredCash, setDeclaredCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [showCloseForm, setShowCloseForm] = useState(false);

  const loadShiftData = async () => {
    if (!currentParkingLot || !user) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      // Buscar turno activo del operador
      const { data: activeData, error: activeErr } = await supabase
        .from('shifts')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id)
        .eq('operator_id', user.id)
        .eq('status', 'OPEN')
        .maybeSingle();

      if (activeErr) throw activeErr;

      if (activeData) {
        // Calcular totales del turno activo desde payments
        const { data: payments } = await supabase
          .from('payments')
          .select('method_type, amount')
          .eq('parking_lot_id', currentParkingLot.id)
          .eq('status', 'APPROVED')
          .gte('paid_at', activeData.opened_at);

        const totals = { cash: 0, pos: 0, mobile: 0, transfer: 0, count: 0 };
        for (const p of payments || []) {
          const amt = Number(p.amount);
          totals.count++;
          if (p.method_type === 'CASH') totals.cash += amt;
          else if (p.method_type === 'POS') totals.pos += amt;
          else if (p.method_type === 'MOBILE_PAYMENT') totals.mobile += amt;
          else if (p.method_type === 'BANK_TRANSFER') totals.transfer += amt;
        }

        const expectedCash = Number(activeData.opening_cash) + totals.cash;

        setActiveShift({
          ...activeData,
          expected_cash: expectedCash,
          cash_total: totals.cash,
          pos_total: totals.pos,
          mobile_total: totals.mobile,
          transfer_total: totals.transfer,
          operations_count: totals.count,
        });
      } else {
        setActiveShift(null);
      }

      // Turnos recientes (últimos 7)
      const { data: recent, error: recentErr } = await supabase
        .from('shifts')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id)
        .eq('status', 'CLOSED')
        .order('closed_at', { ascending: false })
        .limit(7);

      if (recentErr) throw recentErr;
      setRecentShifts((recent || []) as ShiftWithTotals[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar turno.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShiftData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParkingLot?.id, user?.id]);

  // Abrir turno
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParkingLot || !user) return;
    setProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const cashVal = parseFloat(openingCash) || 0;
      const { error } = await supabase.from('shifts').insert({
        parking_lot_id: currentParkingLot.id,
        operator_id: user.id,
        status: 'OPEN',
        opened_at: new Date().toISOString(),
        opening_cash: cashVal,
        expected_cash: cashVal,
        declared_cash: null,
        cash_difference: null,
        notes: null,
      });
      if (error) throw error;

      if (organization?.id && currentParkingLot?.id && user?.id) {
        logAuditEvent({
          organizationId: organization.id,
          parkingLotId: currentParkingLot.id,
          userId: user.id,
          action: 'INSERT',
          entityType: 'shifts',
          metadata: {
            description: `Apertura de turno con fondo de $${cashVal.toFixed(2)} USD`,
            opening_cash: cashVal,
          },
        });
      }

      setSuccessMsg('Turno abierto exitosamente.');
      setOpeningCash('');
      await loadShiftData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al abrir turno.';
      setErrorMsg(msg);
    } finally {
      setProcessing(false);
    }
  };

  // Cerrar turno
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || !user) return;
    setProcessing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const declared = parseFloat(declaredCash) || 0;
      const expected = activeShift.expected_cash ?? 0;
      const difference = declared - expected;
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('shifts')
        .update({
          status: 'CLOSED',
          closed_at: nowIso,
          declared_cash: declared,
          expected_cash: expected,
          cash_difference: difference,
          notes: closeNotes.trim() || null,
          updated_at: nowIso,
        })
        .eq('id', activeShift.id);

      if (error) throw error;

      if (organization?.id && currentParkingLot?.id && user?.id) {
        logAuditEvent({
          organizationId: organization.id,
          parkingLotId: currentParkingLot.id,
          userId: user.id,
          action: 'UPDATE',
          entityType: 'shifts',
          entityId: activeShift.id,
          metadata: {
            description: `Cierre de turno: Declarado $${declared.toFixed(2)}, Esperado $${expected.toFixed(2)}, Dif: $${difference.toFixed(2)} USD`,
            declared_cash: declared,
            expected_cash: expected,
            difference,
          },
        });
      }
      setSuccessMsg(`Turno cerrado. Diferencia de caja: $${difference.toFixed(2)} USD.`);
      setDeclaredCash('');
      setCloseNotes('');
      setShowCloseForm(false);
      await loadShiftData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cerrar turno.';
      setErrorMsg(msg);
    } finally {
      setProcessing(false);
    }
  };

  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!currentParkingLot) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}><h3>Selecciona un estacionamiento</h3></div>;
  }

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-operator">FASE 15: CAJA</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Control de Caja y Turnos</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Apertura y cierre de turno, declaración de efectivo y arqueo de caja.
          </p>
        </div>
        <button type="button" onClick={loadShiftData} disabled={loading} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} /><span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} /><span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando turno…</div>
      ) : activeShift ? (
        /* ── TURNO ACTIVO ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Cabecera turno activo */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--status-success)',
            boxShadow: '0 0 0 1px rgba(16,185,129,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px',
                backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Clock size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#10b981' }}>Turno Abierto</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Desde: {new Date(activeShift.opened_at).toLocaleString()}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowCloseForm(!showCloseForm)}
                className="btn btn-primary"
                style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}
              >
                <LogOut size={16} /> Cerrar Turno
              </button>
            </div>
          </div>

          {/* Resumen de recaudación */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
          }}>
            <MetricCard
              icon={<Banknote size={20} />}
              label="Efectivo Recaudado"
              value={`$${(activeShift.cash_total ?? 0).toFixed(2)}`}
              sub={`Apertura: $${Number(activeShift.opening_cash).toFixed(2)}`}
              color="#10b981"
            />
            <MetricCard
              icon={<CreditCard size={20} />}
              label="Punto de Venta"
              value={`$${(activeShift.pos_total ?? 0).toFixed(2)}`}
              color="var(--accent-primary)"
            />
            <MetricCard
              icon={<Smartphone size={20} />}
              label="Pago Móvil"
              value={`$${(activeShift.mobile_total ?? 0).toFixed(2)}`}
              color="var(--accent-secondary)"
            />
            <MetricCard
              icon={<Building size={20} />}
              label="Transferencia"
              value={`$${(activeShift.transfer_total ?? 0).toFixed(2)}`}
              color="#fbbf24"
            />
            <MetricCard
              icon={<TrendingUp size={20} />}
              label="Operaciones"
              value={`${activeShift.operations_count ?? 0}`}
              sub="pagos aprobados"
              color="var(--accent-primary)"
            />
            <MetricCard
              icon={<DollarSign size={20} />}
              label="Efectivo Esperado"
              value={`$${Number(activeShift.expected_cash ?? 0).toFixed(2)}`}
              sub="apertura + cobros"
              color="#10b981"
            />
          </div>

          {/* Formulario cierre */}
          {showCloseForm && (
            <div style={{
              padding: '1.75rem',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-md)',
            }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LogOut size={18} color="#ef4444" /> Cierre de Turno — Arqueo de Caja
              </h3>
              <form onSubmit={handleCloseShift} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Efectivo Esperado en Caja</label>
                    <div className="input-field" style={{ backgroundColor: 'var(--bg-input)', cursor: 'not-allowed', color: 'var(--text-muted)' }}>
                      ${Number(activeShift.expected_cash ?? 0).toFixed(2)} USD
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Efectivo Declarado * (Conteo físico)</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      className="input-field"
                      placeholder="0.00"
                      value={declaredCash}
                      onChange={(e) => setDeclaredCash(e.target.value)}
                    />
                  </div>
                </div>

                {declaredCash && (
                  <div style={{
                    padding: '0.85rem 1rem',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${parseFloat(declaredCash) - Number(activeShift.expected_cash ?? 0) >= 0 ? 'var(--status-success)' : 'var(--status-error)'}`,
                  }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Diferencia de Caja</div>
                    <div style={{
                      fontWeight: 800, fontSize: '1.25rem', fontFamily: 'var(--font-mono)',
                      color: parseFloat(declaredCash) - Number(activeShift.expected_cash ?? 0) >= 0
                        ? 'var(--status-success)' : 'var(--status-error)',
                    }}>
                      {parseFloat(declaredCash) - Number(activeShift.expected_cash ?? 0) >= 0 ? '+' : ''}
                      ${(parseFloat(declaredCash) - Number(activeShift.expected_cash ?? 0)).toFixed(2)} USD
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Notas del Cierre (opcional)</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Ej: Diferencia por vuelto de $0.50, etc."
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setShowCloseForm(false)} className="btn btn-secondary">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={processing || !declaredCash}
                    className="btn btn-primary"
                    style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                  >
                    {processing ? 'Cerrando…' : 'Confirmar Cierre de Turno'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        /* ── SIN TURNO ACTIVO ── */
        <div style={{
          padding: '2rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
        }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogIn size={18} color="var(--accent-primary)" /> Abrir Nuevo Turno
          </h3>
          <form onSubmit={handleOpenShift} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '420px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Efectivo Inicial en Caja (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-field"
                placeholder="0.00"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Monto de efectivo disponible al inicio del turno (fondo de caja).
              </p>
            </div>
            <button type="submit" disabled={processing} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
              <LogIn size={16} /> {processing ? 'Abriendo…' : 'Abrir Turno'}
            </button>
          </form>
        </div>
      )}

      {/* Historial de turnos (solo OWNER/ADMIN) */}
      {isOwnerOrAdmin && recentShifts.length > 0 && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="var(--accent-primary)" />
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Turnos Recientes Cerrados</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentShifts.map((s, idx) => {
              const diff = Number(s.cash_difference ?? 0);
              return (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1rem 1.5rem',
                  borderBottom: idx < recentShifts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  flexWrap: 'wrap', gap: '0.75rem',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {new Date(s.opened_at).toLocaleDateString()} — {new Date(s.closed_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      Apertura: ${Number(s.opening_cash).toFixed(2)} • Declarado: ${Number(s.declared_cash ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: diff >= 0 ? 'var(--status-success)' : 'var(--status-error)',
                  }}>
                    {diff >= 0 ? '+' : ''}${diff.toFixed(2)} USD
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── MetricCard ── */
const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}> = ({ icon, label, value, sub, color }) => (
  <div style={{
    padding: '1.25rem',
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-sm)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '1.4rem', color }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{sub}</div>}
  </div>
);
