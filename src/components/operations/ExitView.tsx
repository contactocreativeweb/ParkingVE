import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Search, 
  Car, 
  Bike, 
  User, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  CreditCard
} from 'lucide-react';
import type { ParkingSession, Customer, Vehicle, AdditionalService, SessionAdditionalService } from '../../types/database';

interface ExitViewProps {
  initialSessionId?: string | null;
  onProceedToPayment?: (session: ParkingSession) => void;
}

export const ExitView: React.FC<ExitViewProps> = ({ initialSessionId, onProceedToPayment }) => {
  const { currentParkingLot } = useAuth();

  const [searchPlate, setSearchPlate] = useState('');
  const [activeSessions, setActiveSessions] = useState<ParkingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ParkingSession | null>(null);
  const [sessionCustomer, setSessionCustomer] = useState<Customer | null>(null);
  const [sessionVehicle, setSessionVehicle] = useState<Vehicle | null>(null);

  // Tarifas y cálculos
  const [dailyPrice, setDailyPrice] = useState(0);
  const [lostTicketPrice, setLostTicketPrice] = useState(0);
  const [isLostTicket, setIsLostTicket] = useState(false);

  // Servicios adicionales disponibles y consumidos en la sesión
  const [availableServices, setAvailableServices] = useState<AdditionalService[]>([]);
  const [sessionServices, setSessionServices] = useState<SessionAdditionalService[]>([]);
  const [selectedServiceToAdd, setSelectedServiceToAdd] = useState<string>('');

  // Estados de carga y acción
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currency = currentParkingLot?.currency_code || 'USD';

  const normalizePlate = (str: string) => {
    return str.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  };

  // 1. Cargar lista de sesiones activas en el estacionamiento para búsqueda y autocompletado
  const loadActiveSessions = async () => {
    if (!currentParkingLot) return;
    try {
      const { data } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id)
        .in('status', ['ACTIVE', 'PAYMENT_PENDING'])
        .order('entry_at', { ascending: false });

      setActiveSessions((data || []) as ParkingSession[]);

      if (initialSessionId && data) {
        const found = data.find((s) => s.id === initialSessionId);
        if (found) selectSession(found as ParkingSession);
      }
    } catch (err: any) {
      console.warn('Error loading active sessions for exit:', err.message);
    }
  };

  useEffect(() => {
    loadActiveSessions();
  }, [currentParkingLot?.id, initialSessionId]);

  // 2. Cargar servicios adicionales configurados
  useEffect(() => {
    if (!currentParkingLot) return;
    const fetchServices = async () => {
      const { data } = await supabase
        .from('additional_services')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id)
        .eq('is_active', true);
      setAvailableServices((data || []) as AdditionalService[]);
    };
    fetchServices();
  }, [currentParkingLot?.id]);

  // 3. Seleccionar sesión e hidratar datos detallados
  const selectSession = async (session: ParkingSession) => {
    setSelectedSession(session);
    setIsLostTicket(session.lost_ticket);
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // Cargar vehículo
      if (session.vehicle_id) {
        const { data: vData } = await supabase
          .from('vehicles')
          .select('*')
          .eq('id', session.vehicle_id)
          .maybeSingle();
        setSessionVehicle(vData as Vehicle || null);
      }

      // Cargar cliente
      if (session.customer_id) {
        const { data: cData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', session.customer_id)
          .maybeSingle();
        setSessionCustomer(cData as Customer || null);
      } else {
        setSessionCustomer(null);
      }

      // Cargar tarifas del tipo de vehículo
      const { data: tData } = await supabase
        .from('tariffs')
        .select('*')
        .eq('parking_lot_id', currentParkingLot!.id)
        .eq('vehicle_type', session.vehicle_type_snapshot)
        .maybeSingle();

      if (tData) {
        setDailyPrice(Number(tData.daily_price));
        setLostTicketPrice(Number(tData.lost_ticket_price));
      }

      // Cargar servicios adicionales ya vinculados a esta sesión
      const { data: srvData } = await supabase
        .from('session_additional_services')
        .select('*')
        .eq('session_id', session.id);

      setSessionServices((srvData || []) as SessionAdditionalService[]);

    } catch (err: any) {
      console.error('Error loading exit session details:', err);
      setErrorMsg(err.message || 'Error al cargar detalles de la sesión');
    } finally {
      setLoading(false);
    }
  };

  // Recalcular total llamando a la función RPC de Supabase / Backend (Regla 39)
  const triggerBackendRecalculate = async (sessionId: string, lostTicketVal: boolean) => {
    setRecalculating(true);
    try {
      // 1. Actualizar el flag lost_ticket en la sesión
      await supabase
        .from('parking_sessions')
        .update({ lost_ticket: lostTicketVal })
        .eq('id', sessionId);

      // 2. Ejecutar función en PostgreSQL para calcular tarifas del backend
      const { error: rpcErr } = await supabase.rpc('recalculate_session_total', {
        p_session_id: sessionId,
      });

      if (rpcErr) {
        console.warn('RPC recalculate error, falling back to manual update:', rpcErr.message);
      }

      // 3. Recargar la sesión actualizada
      const { data: refreshed } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (refreshed) {
        setSelectedSession(refreshed as ParkingSession);
      }
    } catch (err: any) {
      console.error('Error recalculating backend session:', err);
    } finally {
      setRecalculating(false);
    }
  };

  // Toggle Ticket Perdido (Sección 37)
  const handleToggleLostTicket = async () => {
    if (!selectedSession) return;
    const newLostState = !isLostTicket;
    setIsLostTicket(newLostState);
    await triggerBackendRecalculate(selectedSession.id, newLostState);
  };

  // Agregar Servicio Adicional (Sección 38)
  const handleAddService = async () => {
    if (!selectedSession || !selectedServiceToAdd) return;
    const srv = availableServices.find((s) => s.id === selectedServiceToAdd);
    if (!srv) return;

    try {
      const { data, error } = await supabase
        .from('session_additional_services')
        .insert({
          session_id: selectedSession.id,
          additional_service_id: srv.id,
          service_name_snapshot: srv.name,
          unit_price: srv.price,
          quantity: 1,
          total_price: srv.price,
          currency_code: currency,
        })
        .select()
        .single();

      if (error) throw error;

      setSessionServices((prev) => [...prev, data as SessionAdditionalService]);
      setSelectedServiceToAdd('');

      // Recalcular en backend
      await triggerBackendRecalculate(selectedSession.id, isLostTicket);
    } catch (err: any) {
      console.error('Error adding service to session:', err);
      setErrorMsg(err.message || 'Error al agregar servicio adicional');
    }
  };

  // Eliminar Servicio Adicional
  const handleRemoveService = async (serviceSessionId: string) => {
    if (!selectedSession) return;
    try {
      const { error } = await supabase
        .from('session_additional_services')
        .delete()
        .eq('id', serviceSessionId);

      if (error) throw error;

      setSessionServices((prev) => prev.filter((s) => s.id !== serviceSessionId));
      await triggerBackendRecalculate(selectedSession.id, isLostTicket);
    } catch (err: any) {
      console.error('Error removing service from session:', err);
      setErrorMsg(err.message || 'Error al eliminar servicio adicional');
    }
  };

  // Continuar al Pago (Botón Fase 10 -> Fase 11)
  const handleProceedToPayment = async () => {
    if (!selectedSession) return;
    try {
      // Asegurar que la sesión esté en estado PAYMENT_PENDING y con hora tentativa de salida
      const { data: updated, error } = await supabase
        .from('parking_sessions')
        .update({
          status: 'PAYMENT_PENDING',
          exit_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedSession.id)
        .select()
        .single();

      if (error) throw error;

      if (onProceedToPayment) {
        onProceedToPayment(updated as ParkingSession);
      } else {
        setSuccessMsg(`Operación lista para cobro. Total: $${Number(updated.total_amount).toFixed(2)} USD.`);
      }
    } catch (err: any) {
      console.error('Error proceeding to payment:', err);
      setErrorMsg(err.message || 'Error al continuar al pago');
    }
  };

  // Calcular tiempo transcurrido humano
  const formatElapsedTime = (entryIso: string) => {
    const diffMs = Math.max(0, Date.now() - new Date(entryIso).getTime());
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes} min`;
  };

  // Filtro de sugerencias para búsqueda
  const filteredActiveSessions = activeSessions.filter((s) => {
    if (!searchPlate.trim()) return false;
    const term = normalizePlate(searchPlate);
    return s.plate_snapshot.includes(term);
  });

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <span className="badge badge-operator" style={{ marginBottom: '0.4rem' }}>
          FASE 10: REGISTRO DE SALIDA
        </span>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>
          Registrar Salida y Liquidación
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Busca la matrícula para calcular tarifa, servicios, ticket perdido y continuar al pago.
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

      {/* Buscador de Matrícula para Salida (Sección 58) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        padding: '1.5rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
      }}>
        <label className="form-label" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Buscar Matrícula para Salida
        </label>
        <div style={{ position: 'relative', marginTop: '0.4rem' }}>
          <Search size={20} color="var(--text-muted)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            className="input-field"
            style={{
              paddingLeft: '3rem',
              fontSize: '1.25rem',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
            placeholder="Introduce placa (ej. ABC123)..."
            value={searchPlate}
            onChange={(e) => setSearchPlate(normalizePlate(e.target.value))}
          />
        </div>

        {/* Sugerencias en tiempo real de vehículos estacionados */}
        {filteredActiveSessions.length > 0 && (
          <div style={{
            marginTop: '0.75rem',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-input)',
            maxHeight: '160px',
            overflowY: 'auto',
          }}>
            {filteredActiveSessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => {
                  selectSession(sess);
                  setSearchPlate(sess.plate_snapshot);
                }}
                style={{
                  padding: '0.65rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--border-subtle)',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {sess.plate_snapshot}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ({sess.vehicle_type_snapshot === 'CAR' ? 'Carro' : 'Moto'})
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                  Seleccionar vehículo →
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando detalles de la operación de salida...
        </div>
      )}

      {/* Detalle de Operación de Salida (Sección 36: Cliente, Vehículo, Entrada, Tiempo, Totales) */}
      {!loading && selectedSession && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}>
          
          {/* Fila 1: Resumen de Vehículo y Cliente */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
            paddingBottom: '1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Vehículo
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: selectedSession.vehicle_type_snapshot === 'CAR' ? 'var(--bg-badge)' : 'rgba(6, 182, 212, 0.15)',
                  color: selectedSession.vehicle_type_snapshot === 'CAR' ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {selectedSession.vehicle_type_snapshot === 'CAR' ? <Car size={20} /> : <Bike size={20} />}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                    {selectedSession.plate_snapshot}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {sessionVehicle ? [sessionVehicle.brand, sessionVehicle.model, sessionVehicle.color].filter(Boolean).join(' • ') : 'Sin detalles'}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Cliente
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                <User size={16} color="var(--accent-primary)" />
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  {sessionCustomer ? `${sessionCustomer.first_name || ''} ${sessionCustomer.last_name || ''}`.trim() : 'Cliente Ocasional'}
                </span>
              </div>
              {(sessionCustomer?.phone || selectedSession.customer_phone) && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  📞 {sessionCustomer?.phone || selectedSession.customer_phone}
                </div>
              )}
            </div>
          </div>

          {/* Fila 2: Hora Entrada y Tiempo Estacionado */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            backgroundColor: 'var(--bg-input)',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Hora de Entrada:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                <Calendar size={14} color="var(--text-muted)" />
                {new Date(selectedSession.entry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tiempo Estacionado:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.2rem' }}>
                <Clock size={14} />
                {formatElapsedTime(selectedSession.entry_at)}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tarifa Base:</span>
              <div style={{ fontWeight: 800, color: 'var(--status-success)', fontFamily: 'var(--font-mono)', marginTop: '0.2rem' }}>
                ${dailyPrice.toFixed(2)} {currency}
              </div>
            </div>
          </div>

          {/* Fila 3: Opción Ticket Perdido (Sección 37) */}
          <div style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: isLostTicket ? '1px solid #fbbf24' : '1px solid var(--border-subtle)',
            backgroundColor: isLostTicket ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: isLostTicket ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-card)',
                color: isLostTicket ? '#fbbf24' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: isLostTicket ? '#fbbf24' : 'var(--text-primary)', fontSize: '0.95rem' }}>
                  Ticket Perdido
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Aplica recargo por extravío de ticket configurado (${lostTicketPrice.toFixed(2)} {currency})
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={recalculating}
              onClick={handleToggleLostTicket}
              className={`btn ${isLostTicket ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
            >
              {isLostTicket ? 'Recargo Aplicado ✓' : '+ Aplicar Recargo'}
            </button>
          </div>

          {/* Fila 4: Servicios Adicionales (Sección 38: Casco, Lavado, etc.) */}
          <div style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-input)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Servicios Adicionales
              </span>
              
              {availableServices.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <select
                    aria-label="Seleccionar servicio adicional"
                    className="input-field"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                    value={selectedServiceToAdd}
                    onChange={(e) => setSelectedServiceToAdd(e.target.value)}
                  >
                    <option value="">Seleccionar servicio...</option>
                    {availableServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (${Number(s.price).toFixed(2)} {s.currency_code})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!selectedServiceToAdd || recalculating}
                    onClick={handleAddService}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                  >
                    <Plus size={14} /> Añadir
                  </button>
                </div>
              )}
            </div>

            {/* Listado de servicios añadidos a la sesión */}
            {sessionServices.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                No se han añadido servicios adicionales a esta sesión.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {sessionServices.map((srv) => (
                  <div
                    key={srv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {srv.service_name_snapshot} x {srv.quantity}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--status-success)' }}>
                        +${Number(srv.total_price).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(srv.id)}
                        className="btn btn-ghost"
                        style={{ padding: '0.2rem', color: 'var(--status-error)' }}
                        title="Quitar servicio"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fila 5: TOTAL A PAGAR y Acción (Sección 39 y 58) */}
          <div style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-card-hover)',
            border: '1px solid var(--accent-primary)',
            boxShadow: 'var(--shadow-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Total Calculado en Backend
              </span>
              <div style={{
                fontSize: '2.25rem',
                fontWeight: 900,
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.1,
                marginTop: '0.2rem',
              }}>
                ${Number(selectedSession.total_amount).toFixed(2)}{' '}
                <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {selectedSession.currency_code || currency}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Base (${Number(selectedSession.parking_fee).toFixed(2)}) 
                {isLostTicket && ` + Ticket Perdido ($${Number(selectedSession.lost_ticket_fee).toFixed(2)})`}
                {sessionServices.length > 0 && ` + Servicios ($${Number(selectedSession.additional_services_total).toFixed(2)})`}
              </div>
            </div>

            <button
              type="button"
              disabled={recalculating}
              onClick={handleProceedToPayment}
              className="btn btn-primary"
              style={{
                padding: '1rem 1.75rem',
                fontSize: '1.1rem',
                fontWeight: 800,
                boxShadow: '0 6px 20px rgba(99, 102, 241, 0.4)',
              }}
            >
              <CreditCard size={20} /> CONTINUAR AL PAGO <ArrowRight size={18} />
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
