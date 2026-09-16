import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  BarChart3,
  TrendingUp,
  Car,
  DollarSign,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  Banknote,
  CreditCard,
  Smartphone,
  Building,
  Clock,
  Bike,
} from 'lucide-react';

type PeriodFilter = 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'MONTH';

interface ReportData {
  totalIncome: number;
  totalSessions: number;
  totalCars: number;
  totalMotos: number;
  avgDurationMin: number;
  cashTotal: number;
  posTotal: number;
  mobileTotal: number;
  transferTotal: number;
  approvedPayments: number;
  pendingPayments: number;
}

const emptyReport: ReportData = {
  totalIncome: 0, totalSessions: 0, totalCars: 0, totalMotos: 0,
  avgDurationMin: 0, cashTotal: 0, posTotal: 0, mobileTotal: 0,
  transferTotal: 0, approvedPayments: 0, pendingPayments: 0,
};

export const ReportsView: React.FC = () => {
  const { currentParkingLot } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>('TODAY');
  const [report, setReport] = useState<ReportData>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getDateRange = (p: PeriodFilter): { from: string; to: string } => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    switch (p) {
      case 'TODAY':
        return { from: todayStart.toISOString(), to: tomorrowStart.toISOString() };
      case 'YESTERDAY': {
        const yStart = new Date(todayStart);
        yStart.setDate(yStart.getDate() - 1);
        return { from: yStart.toISOString(), to: todayStart.toISOString() };
      }
      case 'LAST_7': {
        const s7 = new Date(todayStart);
        s7.setDate(s7.getDate() - 7);
        return { from: s7.toISOString(), to: tomorrowStart.toISOString() };
      }
      case 'MONTH': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from: monthStart.toISOString(), to: tomorrowStart.toISOString() };
      }
    }
  };

  const loadReport = async () => {
    if (!currentParkingLot) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { from, to } = getDateRange(period);

      // Pagos aprobados en el período
      const { data: payments, error: payErr } = await supabase
        .from('payments')
        .select('method_type, amount, status')
        .eq('parking_lot_id', currentParkingLot.id)
        .gte('created_at', from)
        .lt('created_at', to);

      if (payErr) throw payErr;

      // Sesiones del período
      const { data: sessions, error: sessErr } = await supabase
        .from('parking_sessions')
        .select('vehicle_type_snapshot, entry_at, exit_at, status')
        .eq('parking_lot_id', currentParkingLot.id)
        .gte('created_at', from)
        .lt('created_at', to);

      if (sessErr) throw sessErr;

      // Calcular métricas
      let totalIncome = 0;
      let cashTotal = 0, posTotal = 0, mobileTotal = 0, transferTotal = 0;
      let approvedPayments = 0, pendingPayments = 0;

      for (const p of payments || []) {
        const amt = Number(p.amount);
        if (p.status === 'APPROVED') {
          totalIncome += amt;
          approvedPayments++;
          if (p.method_type === 'CASH') cashTotal += amt;
          else if (p.method_type === 'POS') posTotal += amt;
          else if (p.method_type === 'MOBILE_PAYMENT') mobileTotal += amt;
          else if (p.method_type === 'BANK_TRANSFER') transferTotal += amt;
        } else {
          pendingPayments++;
        }
      }

      let totalCars = 0, totalMotos = 0;
      let totalDurationMs = 0, countWithDuration = 0;

      for (const s of sessions || []) {
        if (s.vehicle_type_snapshot === 'CAR') totalCars++;
        else totalMotos++;
        if (s.exit_at && s.entry_at) {
          totalDurationMs += new Date(s.exit_at).getTime() - new Date(s.entry_at).getTime();
          countWithDuration++;
        }
      }

      const avgDurationMin = countWithDuration > 0 ? totalDurationMs / countWithDuration / 60_000 : 0;

      setReport({
        totalIncome,
        totalSessions: (sessions || []).length,
        totalCars,
        totalMotos,
        avgDurationMin,
        cashTotal,
        posTotal,
        mobileTotal,
        transferTotal,
        approvedPayments,
        pendingPayments,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al generar reporte.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParkingLot?.id, period]);

  const periodLabels: Record<PeriodFilter, string> = {
    TODAY: 'Hoy',
    YESTERDAY: 'Ayer',
    LAST_7: 'Últimos 7 días',
    MONTH: 'Este Mes',
  };

  if (!currentParkingLot) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}><h3>Selecciona un estacionamiento</h3></div>;
  }

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-operator">FASE 16: REPORTES</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Reportes e Indicadores</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Resumen financiero y operativo por período.
          </p>
        </div>
        <button type="button" onClick={loadReport} disabled={loading} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {/* Filtros de Período */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {(Object.keys(periodLabels) as PeriodFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: period === key ? 700 : 600,
              cursor: 'pointer',
              border: period === key ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              backgroundColor: period === key ? 'var(--bg-badge)' : 'var(--bg-card)',
              color: period === key ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            {periodLabels[key]}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} /><span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Calculando reporte…</div>
      ) : (
        <>
          {/* KPIs principales */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
          }}>
            <KPICard
              icon={<DollarSign size={22} />}
              label="Ingresos Aprobados"
              value={`$${report.totalIncome.toFixed(2)}`}
              sub={`${report.approvedPayments} pagos aprobados`}
              color="#10b981"
              large
            />
            <KPICard
              icon={<Car size={22} />}
              label="Vehículos Atendidos"
              value={`${report.totalSessions}`}
              sub={`${report.totalCars} carros • ${report.totalMotos} motos`}
              color="var(--accent-primary)"
            />
            <KPICard
              icon={<Clock size={22} />}
              label="Duración Promedio"
              value={formatHours(report.avgDurationMin)}
              sub="por sesión completada"
              color="var(--accent-secondary)"
            />
            <KPICard
              icon={<AlertCircle size={22} />}
              label="Pagos Pendientes"
              value={`${report.pendingPayments}`}
              sub="requieren revisión"
              color={report.pendingPayments > 0 ? '#fbbf24' : 'var(--text-muted)'}
            />
          </div>

          {/* Desglose por Método de Pago */}
          <div style={{
            padding: '1.75rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
          }}>
            <h3 style={{
              fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <BarChart3 size={18} color="var(--accent-primary)" /> Desglose por Método de Pago — {periodLabels[period]}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <PaymentMethodBar label="Efectivo" icon={<Banknote size={18} />} amount={report.cashTotal} total={report.totalIncome} color="#10b981" />
              <PaymentMethodBar label="Punto de Venta" icon={<CreditCard size={18} />} amount={report.posTotal} total={report.totalIncome} color="var(--accent-primary)" />
              <PaymentMethodBar label="Pago Móvil" icon={<Smartphone size={18} />} amount={report.mobileTotal} total={report.totalIncome} color="var(--accent-secondary)" />
              <PaymentMethodBar label="Transferencia" icon={<Building size={18} />} amount={report.transferTotal} total={report.totalIncome} color="#fbbf24" />
            </div>
          </div>

          {/* Vehículos: Carros vs Motos */}
          <div style={{
            padding: '1.75rem',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
          }}>
            <h3 style={{
              fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <TrendingUp size={18} color="var(--accent-primary)" /> Distribución de Vehículos — {periodLabels[period]}
            </h3>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Car size={18} color="var(--accent-primary)" />
                  <span style={{ fontWeight: 700 }}>Carros</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, marginLeft: 'auto' }}>{report.totalCars}</span>
                </div>
                <div style={{
                  height: '12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: '6px',
                    width: report.totalSessions > 0 ? `${(report.totalCars / report.totalSessions) * 100}%` : '0%',
                    background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>

              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Bike size={18} color="#fbbf24" />
                  <span style={{ fontWeight: 700 }}>Motos</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, marginLeft: 'auto' }}>{report.totalMotos}</span>
                </div>
                <div style={{
                  height: '12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: '6px',
                    width: report.totalSessions > 0 ? `${(report.totalMotos / report.totalSessions) * 100}%` : '0%',
                    backgroundColor: '#fbbf24',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ── KPICard ── */
const KPICard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  large?: boolean;
}> = ({ icon, label, value, sub, color, large }) => (
  <div style={{
    padding: '1.5rem',
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-md)',
    ...(large ? { borderColor: color, boxShadow: `0 0 0 1px ${color}22, var(--shadow-md)` } : {}),
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: large ? '1.75rem' : '1.4rem', color }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{sub}</div>}
  </div>
);

/* ── PaymentMethodBar ── */
const PaymentMethodBar: React.FC<{
  label: string;
  icon: React.ReactNode;
  amount: number;
  total: number;
  color: string;
}> = ({ label, icon, amount, total, color }) => {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <span style={{ color }}>{icon}</span>
          <span style={{ fontWeight: 600 }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color }}>${amount.toFixed(2)}</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '42px', textAlign: 'right' }}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-input)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '4px', backgroundColor: color,
          width: `${pct}%`, transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
};
