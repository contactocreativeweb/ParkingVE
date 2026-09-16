import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Car, 
  Bike, 
  Clock, 
  Search, 
  RefreshCw, 
  User, 
  ArrowUpRight, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import type { ParkingSession, Customer, Vehicle } from '../../types/database';

interface ActiveSessionItem extends ParkingSession {
  customers?: Customer | null;
  vehicles?: Vehicle | null;
}

interface ActiveVehiclesViewProps {
  onSelectForExit?: (session: ParkingSession) => void;
}

export const ActiveVehiclesView: React.FC<ActiveVehiclesViewProps> = ({ onSelectForExit }) => {
  const { currentParkingLot } = useAuth();

  const [activeSessions, setActiveSessions] = useState<ActiveSessionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Actualizar el cálculo de tiempo transcurrido cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadActiveVehicles = async () => {
    if (!currentParkingLot) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from('parking_sessions')
        .select('*, customers(*), vehicles(*)')
        .eq('parking_lot_id', currentParkingLot.id)
        .in('status', ['ACTIVE', 'PAYMENT_PENDING'])
        .order('entry_at', { ascending: false });

      if (error) throw error;
      setActiveSessions((data || []) as ActiveSessionItem[]);
    } catch (err: any) {
      console.error('Error loading active vehicles:', err);
      setErrorMsg(err.message || 'Error al consultar vehículos activos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveVehicles();
  }, [currentParkingLot?.id]);

  // Formato de tiempo transcurrido humano
  const formatElapsedTime = (entryIso: string) => {
    const diffMs = Math.max(0, currentTime - new Date(entryIso).getTime());
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    const days = Math.floor(hours / 24);

    if (days > 0) {
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} min`;
  };

  // Métricas
  const totalCars = activeSessions.filter((s) => s.vehicle_type_snapshot === 'CAR').length;
  const totalMotos = activeSessions.filter((s) => s.vehicle_type_snapshot === 'MOTORCYCLE').length;

  // Filtrado
  const filteredSessions = activeSessions.filter((s) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const plateMatch = s.plate_snapshot.toLowerCase().includes(term.replace(/[^a-z0-9]/g, ''));
    const cust = s.customers;
    const nameMatch = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.toLowerCase().includes(term) : false;
    const phoneMatch = (cust?.phone || s.customer_phone || '').toLowerCase().includes(term);

    return plateMatch || nameMatch || phoneMatch;
  });

  if (!currentParkingLot) {
    return (
      <div style={{
        padding: '3rem 1.5rem',
        textAlign: 'center',
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
      }}>
        <Car size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3>Selecciona un estacionamiento para consultar vehículos activos</h3>
      </div>
    );
  }

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
            <span className="badge badge-operator">FASE 9: VEHÍCULOS ACTIVOS</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Vehículos Actualmente Dentro</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Control en tiempo real de vehículos estacionados, hora de entrada y tiempo transcurrido.
          </p>
        </div>

        <button
          type="button"
          onClick={loadActiveVehicles}
          disabled={loading}
          className="btn btn-secondary"
          title="Actualizar listado de vehículos"
          style={{ fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </div>

      {/* Métricas Rápidas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
      }}>
        <div style={{
          backgroundColor: 'var(--bg-card)',
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--status-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Car size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Estacionados
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {activeSessions.length}
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Car size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Carros
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {totalCars}
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-card)',
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: 'rgba(6, 182, 212, 0.15)',
            color: 'var(--accent-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Bike size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Motos
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {totalMotos}
            </div>
          </div>
        </div>
      </div>

      {/* Alerta de Error */}
      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Barra de Filtro Rápido */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        padding: '0.75rem 1.25rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <Search size={18} color="var(--text-muted)" />
        <input
          type="text"
          className="input-field"
          style={{ border: 'none', padding: '0.4rem 0', backgroundColor: 'transparent', boxShadow: 'none' }}
          placeholder="Filtrar por matrícula o nombre de cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="btn btn-ghost"
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Lista de Vehículos Activos (Sección 57) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Consultando vehículos en estacionamiento...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <Car size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.15rem' }}>
              {searchTerm ? 'No se encontraron coincidencias' : 'No hay vehículos estacionados actualmente'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
              {searchTerm ? 'Prueba con otra placa o cliente' : 'Los vehículos que ingresen aparecerán aquí en tiempo real con su conteo de tiempo.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredSessions.map((session, index) => {
              const cust = session.customers;
              const veh = session.vehicles;
              const isCar = session.vehicle_type_snapshot === 'CAR';
              const customerName = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : null;

              return (
                <div
                  key={session.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem 1.5rem',
                    borderBottom: index < filteredSessions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Columna 1: Matrícula y Tipo */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      backgroundColor: isCar ? 'rgba(99, 102, 241, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                      color: isCar ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isCar ? <Car size={22} /> : <Bike size={22} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          fontSize: '1.25rem',
                          color: 'var(--text-primary)',
                          letterSpacing: '0.05em',
                        }}>
                          {session.plate_snapshot}
                        </span>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isCar ? 'rgba(99, 102, 241, 0.12)' : 'rgba(6, 182, 212, 0.12)',
                          color: isCar ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                        }}>
                          {isCar ? 'CARRO' : 'MOTO'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {veh ? [veh.brand, veh.model, veh.color].filter(Boolean).join(' • ') : 'Vehículo no especificado'}
                      </div>
                    </div>
                  </div>

                  {/* Columna 2: Cliente */}
                  <div style={{ minWidth: '180px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Cliente
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <User size={14} color="var(--accent-primary)" />
                      {customerName || 'Cliente Ocasional'}
                    </div>
                    {(cust?.phone || session.customer_phone) && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                        📞 {cust?.phone || session.customer_phone}
                      </div>
                    )}
                  </div>

                  {/* Columna 3: Hora Entrada y Tiempo Transcurrido */}
                  <div style={{ minWidth: '170px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Hora de Entrada
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Calendar size={13} color="var(--text-muted)" />
                      {new Date(session.entry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      marginTop: '0.3rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      color: '#fbbf24',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                    }}>
                      <Clock size={12} />
                      {formatElapsedTime(session.entry_at)}
                    </div>
                  </div>

                  {/* Columna 4: Acción (Salida / Cobro) */}
                  <div>
                    {onSelectForExit ? (
                      <button
                        type="button"
                        onClick={() => onSelectForExit(session)}
                        className="btn btn-primary"
                        style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                      >
                        Registrar Salida <ArrowUpRight size={15} />
                      </button>
                    ) : (
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: 'var(--status-success)',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        Tarifa: ${Number(session.parking_fee).toFixed(2)}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
