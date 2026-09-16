import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Car,
  DollarSign,
  Clock,
  Activity,
  PlusCircle,
  LogOut,
  Users,
  CreditCard,
  RefreshCw,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  MapPin,
  UserCheck,
  ChevronRight
} from 'lucide-react';
import type { ParkingSession } from '../../types/database';

interface DashboardMVPProps {
  onNavigate: (tab: any) => void;
}

interface DashboardMetrics {
  vehiclesInside: number;
  carsInside: number;
  bikesInside: number;
  incomeToday: number;
  paymentsPending: number;
  operationsToday: number;
  recentSessions: ParkingSession[];
}

export const DashboardMVP: React.FC<DashboardMVPProps> = ({ onNavigate }) => {
  const { currentParkingLot, organization, user, role } = useAuth();

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    vehiclesInside: 0,
    carsInside: 0,
    bikesInside: 0,
    incomeToday: 0,
    paymentsPending: 0,
    operationsToday: 0,
    recentSessions: [],
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadDashboardData = async () => {
    if (!currentParkingLot) return;
    setLoading(true);

    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // 1. Vehículos dentro (sesiones activas)
      const { data: activeSessions, error: activeErr } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id)
        .eq('status', 'ACTIVE')
        .order('entry_at', { ascending: false });

      if (activeErr) throw activeErr;

      const activeList = (activeSessions || []) as ParkingSession[];
      const vehiclesInside = activeList.length;
      const carsInside = activeList.filter((s) => s.vehicle_type_snapshot === 'CAR').length;
      const bikesInside = activeList.filter((s) => s.vehicle_type_snapshot === 'MOTORCYCLE').length;

      // 2. Ingresos de hoy (pagos aprobados hoy)
      const { data: todayPayments, error: payErr } = await supabase
        .from('payments')
        .select('amount, status, paid_at')
        .eq('parking_lot_id', currentParkingLot.id)
        .eq('status', 'APPROVED')
        .gte('paid_at', startOfDay);

      if (payErr) throw payErr;

      const incomeToday = (todayPayments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      // 3. Pagos pendientes de revisión
      const { count: pendingCount, error: pendingErr } = await supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('parking_lot_id', currentParkingLot.id)
        .in('status', ['UNDER_REVIEW', 'RECEIPT_REQUIRED', 'PENDING']);

      if (pendingErr) throw pendingErr;

      // 4. Operaciones de hoy (sesiones iniciadas hoy)
      const { count: opsCount, error: opsErr } = await supabase
        .from('parking_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('parking_lot_id', currentParkingLot.id)
        .gte('entry_at', startOfDay);

      if (opsErr) throw opsErr;

      setMetrics({
        vehiclesInside,
        carsInside,
        bikesInside,
        incomeToday,
        paymentsPending: pendingCount || 0,
        operationsToday: opsCount || 0,
        recentSessions: activeList.slice(0, 5),
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading dashboard MVP metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    // Auto refrescar cada 30 segundos
    const interval = setInterval(loadDashboardData, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParkingLot?.id]);

  if (!currentParkingLot || !organization) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <h3>Selecciona un estacionamiento para visualizar el Dashboard</h3>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Encabezado Superior con Estado y Botón de Recarga */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-operator">
              <ShieldCheck size={13} /> DASHBOARD MVP
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong>
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
            Panel de Control
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Resumen en tiempo real del flujo operativo e ingresos.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Actualizado {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <button
            type="button"
            onClick={loadDashboardData}
            disabled={loading}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* SECCIÓN 66: LOS 4 KPIs PRINCIPALES DEL MVP */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem',
      }}>
        
        {/* KPI 1: VEHÍCULOS DENTRO */}
        <div 
          onClick={() => onNavigate('active-vehicles')}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Vehículos Dentro
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Car size={20} />
            </div>
          </div>

          <div style={{ margin: '1.25rem 0 0.75rem' }}>
            <div style={{ fontSize: '2.75rem', fontWeight: 900, lineHeight: 1, color: 'var(--text-primary)' }}>
              {metrics.vehiclesInside}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>🚗 {metrics.carsInside} Carros</span>
              <span>•</span>
              <span>🏍️ {metrics.bikesInside} Motos</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
            <span>Ver listado activo</span>
            <ArrowUpRight size={14} />
          </div>
        </div>

        {/* KPI 2: INGRESOS HOY */}
        <div 
          onClick={() => onNavigate('reports')}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--status-success)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Ingresos Hoy
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: 'var(--status-success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <DollarSign size={20} />
            </div>
          </div>

          <div style={{ margin: '1.25rem 0 0.75rem' }}>
            <div style={{ fontSize: '2.75rem', fontWeight: 900, lineHeight: 1, color: 'var(--status-success)' }}>
              ${metrics.incomeToday.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.6rem' }}>
              Moneda: {currentParkingLot.currency_code || 'USD'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--status-success)', fontWeight: 600 }}>
            <span>Ver reporte financiero</span>
            <ArrowUpRight size={14} />
          </div>
        </div>

        {/* KPI 3: PAGOS PENDIENTES */}
        <div 
          onClick={() => onNavigate('payments-review')}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: metrics.paymentsPending > 0 ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-subtle)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--status-warning)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = metrics.paymentsPending > 0 ? 'rgba(245, 158, 11, 0.4)' : 'var(--border-subtle)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Pagos Pendientes
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: metrics.paymentsPending > 0 ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-input)',
              color: metrics.paymentsPending > 0 ? 'var(--status-warning)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Clock size={20} />
            </div>
          </div>

          <div style={{ margin: '1.25rem 0 0.75rem' }}>
            <div style={{ 
              fontSize: '2.75rem', 
              fontWeight: 900, 
              lineHeight: 1, 
              color: metrics.paymentsPending > 0 ? 'var(--status-warning)' : 'var(--text-primary)' 
            }}>
              {metrics.paymentsPending}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.6rem' }}>
              {metrics.paymentsPending === 0 ? 'Al día, sin pagos por revisar' : 'Requieren revisión de taquilla'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--status-warning)', fontWeight: 600 }}>
            <span>Revisar transferencias / comprobantes</span>
            <ArrowUpRight size={14} />
          </div>
        </div>

        {/* KPI 4: OPERACIONES HOY */}
        <div 
          onClick={() => onNavigate('reports')}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-secondary)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
              Operaciones Hoy
            </span>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(6, 182, 212, 0.12)',
              color: 'var(--accent-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Activity size={20} />
            </div>
          </div>

          <div style={{ margin: '1.25rem 0 0.75rem' }}>
            <div style={{ fontSize: '2.75rem', fontWeight: 900, lineHeight: 1, color: 'var(--text-primary)' }}>
              {metrics.operationsToday}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.6rem' }}>
              Entradas registradas durante el día
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--accent-secondary)', fontWeight: 600 }}>
            <span>Histórico operacional</span>
            <ArrowUpRight size={14} />
          </div>
        </div>

      </div>

      {/* SECCIÓN 66: ACCIONES RÁPIDAS (MENOS CLICS, MÁS VELOCIDAD) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        padding: '1.5rem',
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
            Acciones Rápidas de Operador
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Operaciones de un toque para atención inmediata al cliente.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
        }}>
          {/* + ENTRADA */}
          <button
            type="button"
            onClick={() => onNavigate('entry')}
            style={{
              padding: '1.15rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              boxShadow: 'var(--shadow-md)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-primary)')}
          >
            <PlusCircle size={20} />
            + ENTRADA
          </button>

          {/* SALIDA */}
          <button
            type="button"
            onClick={() => onNavigate('exit')}
            style={{
              padding: '1.15rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.backgroundColor = 'var(--bg-input)';
            }}
          >
            <LogOut size={20} />
            SALIDA
          </button>

          {/* CLIENTES */}
          <button
            type="button"
            onClick={() => onNavigate('customers')}
            style={{
              padding: '1.15rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.backgroundColor = 'var(--bg-input)';
            }}
          >
            <Users size={20} />
            CLIENTES
          </button>

          {/* PAGOS */}
          <button
            type="button"
            onClick={() => onNavigate('payment')}
            style={{
              padding: '1.15rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              fontWeight: 800,
              fontSize: '1rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.backgroundColor = 'var(--bg-input)';
            }}
          >
            <CreditCard size={20} />
            PAGOS
          </button>
        </div>
      </div>

      {/* Grid Inferior: Vehículos Recientes y Contexto Multi-Tenant */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
      }}>
        
        {/* Lista Rápida de Vehículos Activos Dentro */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Car size={18} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Últimos Vehículos en Estacionamiento</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('active-vehicles')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                }}
              >
                Ver todos <ChevronRight size={14} />
              </button>
            </div>

            {metrics.recentSessions.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No hay vehículos en el estacionamiento en este momento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {metrics.recentSessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => onNavigate('active-vehicles')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background-color 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-input)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>
                        {s.vehicle_type_snapshot === 'CAR' ? '🚗' : '🏍️'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                          {s.plate_snapshot}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Tarifa: ${Number(s.parking_fee).toFixed(2)} USD
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Entrada: {new Date(s.entry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span className="badge badge-operator" style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', marginTop: '0.2rem' }}>
                        DENTRO
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('entry')}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.25rem', fontSize: '0.875rem' }}
          >
            <PlusCircle size={16} /> Registrar Nueva Entrada
          </button>
        </div>

        {/* Tarjeta de Jerarquía Multi-Tenant & Estado Operativo */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <ShieldCheck size={18} color="var(--status-success)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Entorno de Operación Multi-Tenant</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <Building2 size={20} color="var(--accent-primary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Organización
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{organization.name}</div>
                </div>
                <span className="badge badge-owner" style={{ fontSize: '0.7rem' }}>
                  {organization.country_code}
                </span>
              </div>

              <div style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <MapPin size={20} color="var(--accent-secondary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Sede Activa
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{currentParkingLot.name}</div>
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {currentParkingLot.timezone}
                </span>
              </div>

              <div style={{
                padding: '0.85rem 1rem',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <UserCheck size={20} color="var(--status-success)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Operador en Sesión
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {user?.email}
                  </div>
                </div>
                <span className="badge badge-operator" style={{ fontSize: '0.7rem' }}>
                  ROL: {role}
                </span>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '1.25rem',
            padding: '0.85rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
            border: '1px dashed var(--accent-primary)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
          }}>
            🔐 <strong>Seguridad Multi-Tenant RLS Activa:</strong> Todos los datos de clientes, vehículos, pagos y turnos están aislados por organización y sede física.
          </div>
        </div>

      </div>

    </div>
  );
};
