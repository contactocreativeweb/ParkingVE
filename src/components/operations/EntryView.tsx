import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Car, 
  Bike, 
  LogIn, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  Search, 
  UserCheck
} from 'lucide-react';
import { logAuditEvent } from '../../lib/audit';
import type { VehicleType, Vehicle, Customer, ParkingSession } from '../../types/database';

export const EntryView: React.FC = () => {
  const { currentParkingLot, organization, user } = useAuth();

  const [plateInput, setPlateInput] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR');
  const [entryNotes, setEntryNotes] = useState('');

  // Estados de detección
  const [searching, setSearching] = useState(false);
  const [existingVehicle, setExistingVehicle] = useState<Vehicle | null>(null);
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [activeSession, setActiveSession] = useState<ParkingSession | null>(null);

  // Formulario rápido para cliente nuevo (opcional / expandible)
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustFirstName, setNewCustFirstName] = useState('');
  const [newCustLastName, setNewCustLastName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustId, setNewCustId] = useState('');

  // Detalles opcionales de nuevo vehículo
  const [vehBrand, setVehBrand] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehColor, setVehColor] = useState('');

  // Estados de acción
  const [submitting, setSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<{
    plate: string;
    type: VehicleType;
    entryTime: string;
    customerName?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const plateInputRef = useRef<HTMLInputElement>(null);

  const normalizePlate = (str: string) => {
    return str.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  };

  // Mantener autofocus en el campo matrícula (Principio UX: velocidad para el operador)
  useEffect(() => {
    plateInputRef.current?.focus();
  }, []);

  // Búsqueda reactiva de vehículo y sesión activa cuando cambia la matrícula
  useEffect(() => {
    const cleanPlate = normalizePlate(plateInput);
    if (!currentParkingLot || cleanPlate.length < 3) {
      setExistingVehicle(null);
      setExistingCustomer(null);
      setActiveSession(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setErrorMsg(null);

      try {
        // 1. Buscar si el vehículo ya existe en este estacionamiento
        const { data: vehData } = await supabase
          .from('vehicles')
          .select('*, customers(*)')
          .eq('parking_lot_id', currentParkingLot.id)
          .eq('plate', cleanPlate)
          .maybeSingle();

        if (vehData) {
          setExistingVehicle(vehData as Vehicle);
          setVehicleType(vehData.vehicle_type);
          if (vehData.customers) {
            setExistingCustomer(vehData.customers as Customer);
          } else {
            setExistingCustomer(null);
          }

          // 2. Regla 32: Validar si ya tiene una sesión activa
          const { data: sessData } = await supabase
            .from('parking_sessions')
            .select('*')
            .eq('parking_lot_id', currentParkingLot.id)
            .eq('vehicle_id', vehData.id)
            .in('status', ['ACTIVE', 'PAYMENT_PENDING'])
            .maybeSingle();

          setActiveSession(sessData as ParkingSession || null);
        } else {
          setExistingVehicle(null);
          setExistingCustomer(null);
          setActiveSession(null);
        }
      } catch (err: any) {
        console.warn('Error checking vehicle:', err.message);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [plateInput, currentParkingLot?.id]);

  const handleRegisterEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParkingLot || !user) return;

    const cleanPlate = normalizePlate(plateInput);
    if (!cleanPlate || cleanPlate.length < 3) {
      setErrorMsg('Por favor introduce una matrícula válida (mínimo 3 caracteres)');
      return;
    }

    if (activeSession) {
      setErrorMsg(`El vehículo ${cleanPlate} ya tiene una sesión activa iniciada.`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessTicket(null);

    try {
      let vehicleId = existingVehicle?.id;
      let customerId = existingCustomer?.id;

      // 1. Si se llenó el formulario de nuevo cliente, crearlo
      if (!customerId && showNewCustomerForm && newCustFirstName.trim()) {
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({
            parking_lot_id: currentParkingLot.id,
            first_name: newCustFirstName.trim(),
            last_name: newCustLastName.trim() || null,
            phone: newCustPhone.trim() || null,
            email: newCustEmail.trim() || null,
            identification_number: newCustId.trim() || null,
            is_active: true,
          })
          .select()
          .single();

        if (custErr) throw custErr;
        customerId = newCust.id;
      }

      // 2. Si el vehículo no existía, crearlo
      if (!vehicleId) {
        const { data: newVeh, error: vehErr } = await supabase
          .from('vehicles')
          .insert({
            parking_lot_id: currentParkingLot.id,
            customer_id: customerId || null,
            plate: cleanPlate,
            vehicle_type: vehicleType,
            brand: vehBrand.trim() || null,
            model: vehModel.trim() || null,
            color: vehColor.trim() || null,
          })
          .select()
          .single();

        if (vehErr) throw vehErr;
        vehicleId = newVeh.id;
      } else if (customerId && !existingVehicle?.customer_id) {
        // Asociar vehículo al cliente si no lo estaba
        await supabase
          .from('vehicles')
          .update({ customer_id: customerId })
          .eq('id', vehicleId);
      }

      // 3. Obtener tarifa diaria configurada en la BD para este tipo de vehículo
      const { data: tariffData } = await supabase
        .from('tariffs')
        .select('daily_price')
        .eq('parking_lot_id', currentParkingLot.id)
        .eq('vehicle_type', vehicleType)
        .maybeSingle();

      const dailyPrice = tariffData?.daily_price || 0;

      // 4. Crear la sesión de estacionamiento (parking_sessions)
      const nowIso = new Date().toISOString();
      const { data: sessionData, error: sessionErr } = await supabase
        .from('parking_sessions')
        .insert({
          parking_lot_id: currentParkingLot.id,
          vehicle_id: vehicleId,
          customer_id: customerId || null,
          plate_snapshot: cleanPlate,
          vehicle_type_snapshot: vehicleType,
          entry_at: nowIso,
          status: 'ACTIVE',
          parking_fee: dailyPrice,
          total_amount: dailyPrice,
          currency_code: currentParkingLot.currency_code || 'USD',
          customer_email: newCustEmail.trim() || existingCustomer?.email || null,
          customer_phone: newCustPhone.trim() || existingCustomer?.phone || null,
          entry_operator_id: user.id,
          entry_notes: entryNotes.trim() || null,
        })
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      // Registrar auditoría (Fase 17)
      if (organization?.id) {
        logAuditEvent({
          organizationId: organization.id,
          parkingLotId: currentParkingLot.id,
          userId: user.id,
          action: 'INSERT',
          entityType: 'parking_sessions',
          entityId: sessionData.id,
          metadata: {
            description: `Entrada: ${cleanPlate} (${vehicleType === 'CAR' ? 'Carro' : 'Moto'})`,
            plate: cleanPlate,
            vehicle_type: vehicleType,
          },
        });
      }

      // Éxito: Mostrar ticket / notificación
      const custDisplay = existingCustomer 
        ? `${existingCustomer.first_name} ${existingCustomer.last_name || ''}`.trim()
        : newCustFirstName.trim() ? `${newCustFirstName} ${newCustLastName}`.trim() : undefined;

      setSuccessTicket({
        plate: cleanPlate,
        type: vehicleType,
        entryTime: new Date(sessionData.entry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        customerName: custDisplay,
      });

      // Limpiar formulario para el siguiente vehículo y enfocar
      setPlateInput('');
      setEntryNotes('');
      setExistingVehicle(null);
      setExistingCustomer(null);
      setActiveSession(null);
      setShowNewCustomerForm(false);
      setNewCustFirstName('');
      setNewCustLastName('');
      setNewCustPhone('');
      setNewCustEmail('');
      setNewCustId('');
      setVehBrand('');
      setVehModel('');
      setVehColor('');

      setTimeout(() => {
        plateInputRef.current?.focus();
      }, 50);

    } catch (err: any) {
      console.error('Error creating parking session:', err);
      setErrorMsg(err.message || 'Error al registrar la entrada del vehículo');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentParkingLot) {
    return (
      <div style={{
        padding: '3rem 1.5rem',
        textAlign: 'center',
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
      }}>
        <LogIn size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3>Selecciona un estacionamiento para registrar entradas</h3>
      </div>
    );
  }

  const isDuplicateActive = !!activeSession;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Rápido */}
      <div style={{ textAlign: 'center' }}>
        <span className="badge badge-operator" style={{ marginBottom: '0.4rem' }}>
          FASE 8: REGISTRO DE ENTRADA
        </span>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
          Registrar Entrada
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong> • Flujo rápido en 1 clic
        </p>
      </div>

      {/* Ticket de éxito reciente */}
      {successTicket && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'var(--status-success)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#6ee7b7', fontWeight: 600, textTransform: 'uppercase' }}>
                Entrada Registrada con Éxito
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.25rem', color: '#fff' }}>
                  {successTicket.plate}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  ({successTicket.type === 'CAR' ? 'Carro' : 'Moto'}) • Hora: {successTicket.entryTime}
                </span>
              </div>
              {successTicket.customerName && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Cliente: {successTicket.customerName}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSuccessTicket(null)}
            className="btn btn-ghost"
            style={{ color: '#6ee7b7', fontSize: '0.8rem' }}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Alerta de Error */}
      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Formulario Principal de Entrada */}
      <form onSubmit={handleRegisterEntry} style={{
        backgroundColor: 'var(--bg-card)',
        padding: '2rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}>
        
        {/* Campo 1: MATRÍCULA (Grande y prominente) */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Matrícula del Vehículo (Placa) *
          </label>
          <div style={{ position: 'relative' }}>
            <input
              ref={plateInputRef}
              type="text"
              required
              autoFocus
              className="input-field"
              placeholder="Ej. ABC123"
              value={plateInput}
              onChange={(e) => setPlateInput(normalizePlate(e.target.value))}
              style={{
                fontSize: '1.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textAlign: 'center',
                padding: '1rem',
                textTransform: 'uppercase',
                borderWidth: '2px',
                borderColor: isDuplicateActive ? 'var(--status-error)' : existingVehicle ? 'var(--accent-primary)' : 'var(--border-subtle)',
              }}
            />
            {searching && (
              <div style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}>
                <Search size={20} className="animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* ALERTA: Regla 32 - Sesión activa duplicada */}
        {isDuplicateActive && (
          <div className="alert alert-error" style={{ margin: 0 }}>
            <ShieldAlert size={20} style={{ flexShrink: 0 }} />
            <div>
              <strong>Vehículo ya dentro del estacionamiento:</strong>
              <div style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Tiene una sesión activa iniciada el {new Date(activeSession.entry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Debe registrar su salida antes de una nueva entrada.
              </div>
            </div>
          </div>
        )}

        {/* Campo 2: CARRO / MOTO (Botones de 1 clic) */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Tipo de Vehículo</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setVehicleType('CAR')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.65rem',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '1.05rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: vehicleType === 'CAR' ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                backgroundColor: vehicleType === 'CAR' ? 'var(--bg-badge)' : 'var(--bg-input)',
                color: vehicleType === 'CAR' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Car size={22} /> CARRO
            </button>

            <button
              type="button"
              onClick={() => setVehicleType('MOTORCYCLE')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.65rem',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '1.05rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: vehicleType === 'MOTORCYCLE' ? '2px solid var(--accent-secondary)' : '1px solid var(--border-subtle)',
                backgroundColor: vehicleType === 'MOTORCYCLE' ? 'rgba(6, 182, 212, 0.12)' : 'var(--bg-input)',
                color: vehicleType === 'MOTORCYCLE' ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <Bike size={22} /> MOTO
            </button>
          </div>
        </div>

        {/* Sección 35: Si el vehículo o cliente ya existe, mostrarlo */}
        {existingVehicle && (
          <div style={{
            padding: '1.25rem',
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <UserCheck size={16} color="var(--status-success)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--status-success)', textTransform: 'uppercase' }}>
                Vehículo Registrado Previamente
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  {existingCustomer ? `${existingCustomer.first_name} ${existingCustomer.last_name || ''}`.trim() : 'Sin cliente asociado'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  {[existingVehicle.brand, existingVehicle.model, existingVehicle.color].filter(Boolean).join(' • ') || 'Vehículo sin detalles adicionales'}
                </div>
              </div>
              {existingCustomer?.phone && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  📞 {existingCustomer.phone}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sección 34: Si no existe, permitir registrar cliente rápido en 1 clic */}
        {!existingVehicle && plateInput.length >= 3 && (
          <div style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Vehículo nuevo en esta sede
              </span>
              <button
                type="button"
                onClick={() => setShowNewCustomerForm(!showNewCustomerForm)}
                className="btn btn-ghost"
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', color: 'var(--accent-primary)' }}
              >
                {showNewCustomerForm ? 'Omitir datos del cliente' : '+ Asociar Cliente Nuevo'}
              </button>
            </div>

            {showNewCustomerForm && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Nombre</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej. Juan"
                    value={newCustFirstName}
                    onChange={(e) => setNewCustFirstName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Apellido</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej. Pérez"
                    value={newCustLastName}
                    onChange={(e) => setNewCustLastName(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Teléfono</label>
                  <input
                    type="tel"
                    className="input-field"
                    placeholder="Ej. 04121234567"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Marca / Modelo</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Ej. Toyota Corolla"
                    value={vehModel}
                    onChange={(e) => setVehModel(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notas de entrada (opcional) */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>Notas de Entrada (Opcional)</label>
          <input
            type="text"
            className="input-field"
            placeholder="Ej. Rayón en puerta, sin espejo lateral, etc."
            value={entryNotes}
            onChange={(e) => setEntryNotes(e.target.value)}
          />
        </div>

        {/* Botón Principal de Entrada (Fase 8: REGISTRAR ENTRADA) */}
        <button
          type="submit"
          disabled={submitting || isDuplicateActive || plateInput.length < 3}
          className="btn btn-primary"
          style={{
            padding: '1.15rem',
            fontSize: '1.15rem',
            fontWeight: 800,
            borderRadius: 'var(--radius-md)',
            letterSpacing: '0.02em',
            marginTop: '0.5rem',
          }}
        >
          {submitting ? 'Registrando entrada...' : (
            <>
              <LogIn size={22} /> REGISTRAR ENTRADA
            </>
          )}
        </button>

      </form>

    </div>
  );
};
