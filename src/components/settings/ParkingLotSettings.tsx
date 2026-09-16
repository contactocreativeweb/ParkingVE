import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  DollarSign, 
  Clock, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert,
  PlusCircle
} from 'lucide-react';
import type { ParkingLot } from '../../types/database';

export const ParkingLotSettings: React.FC = () => {
  const { organization, role, currentParkingLot, parkingLots, setCurrentParkingLot, refreshTenantContext } = useAuth();

  const isEditable = role === 'OWNER' || role === 'ADMIN';

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [timezone, setTimezone] = useState('America/Caracas');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal / Form para crear nueva sede
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newLotName, setNewLotName] = useState('');
  const [newLotAddress, setNewLotAddress] = useState('');
  const [creating, setCreating] = useState(false);

  // Sincronizar formulario cuando cambia el estacionamiento seleccionado
  useEffect(() => {
    if (currentParkingLot) {
      setName(currentParkingLot.name || '');
      setAddress(currentParkingLot.address || '');
      setPhone(currentParkingLot.phone || '');
      setEmail(currentParkingLot.email || '');
      setCurrencyCode(currentParkingLot.currency_code || 'USD');
      setTimezone(currentParkingLot.timezone || 'America/Caracas');
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [currentParkingLot]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParkingLot || !isEditable) return;

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from('parking_lots')
        .update({
          name: name.trim(),
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          currency_code: currencyCode,
          timezone: timezone,
        })
        .eq('id', currentParkingLot.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setCurrentParkingLot(data as ParkingLot);
      }
      await refreshTenantContext();
      setSuccessMsg('Configuración del estacionamiento actualizada correctamente.');
    } catch (err: any) {
      console.error('Error updating parking lot:', err);
      setErrorMsg(err.message || 'Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !isEditable || !newLotName.trim()) return;

    setCreating(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from('parking_lots')
        .insert({
          organization_id: organization.id,
          name: newLotName.trim(),
          address: newLotAddress.trim() || null,
          currency_code: 'USD',
          timezone: 'America/Caracas',
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Crear tarifas iniciales por defecto para la nueva sede
      await supabase.from('tariffs').insert([
        {
          parking_lot_id: data.id,
          vehicle_type: 'CAR',
          daily_price: 2.0,
          lost_ticket_price: 10.0,
          currency_code: 'USD',
          is_active: true,
        },
        {
          parking_lot_id: data.id,
          vehicle_type: 'MOTORCYCLE',
          daily_price: 1.0,
          lost_ticket_price: 5.0,
          currency_code: 'USD',
          is_active: true,
        },
      ]);

      await refreshTenantContext();
      setCurrentParkingLot(data as ParkingLot);
      setIsCreatingNew(false);
      setNewLotName('');
      setNewLotAddress('');
      setSuccessMsg(`Nueva sede "${data.name}" creada con éxito.`);
    } catch (err: any) {
      console.error('Error creating new parking lot:', err);
      setErrorMsg(err.message || 'Error al crear la sede.');
    } finally {
      setCreating(false);
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
        <Building2 size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3>No tienes un estacionamiento seleccionado o asignado</h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Selecciona una sede en la barra superior o contacta a un administrador.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Encabezado de Sección */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <span className="badge badge-admin" style={{ marginBottom: '0.4rem' }}>
            FASE 4: CONFIGURACIÓN
          </span>
          <h2 style={{ fontSize: '1.75rem', marginTop: '0.25rem' }}>Mi Estacionamiento</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Administra los datos generales, ubicación, moneda y zona horaria de la sede actual.
          </p>
        </div>

        {isEditable && !isCreatingNew && (
          <button
            type="button"
            onClick={() => setIsCreatingNew(true)}
            className="btn btn-secondary"
            style={{ fontSize: '0.875rem' }}
          >
            <PlusCircle size={16} /> Nueva Sede
          </button>
        )}
      </div>

      {/* Selector rápido de sede si hay múltiples */}
      {parkingLots.length > 1 && (
        <div style={{
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sedes registradas:</span>
          {parkingLots.map((lot) => (
            <button
              key={lot.id}
              type="button"
              onClick={() => setCurrentParkingLot(lot)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: lot.id === currentParkingLot.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                backgroundColor: lot.id === currentParkingLot.id ? 'var(--bg-badge)' : 'var(--bg-input)',
                color: lot.id === currentParkingLot.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {lot.name}
            </button>
          ))}
        </div>
      )}

      {/* Modal / Formulario para Agregar Nueva Sede */}
      {isCreatingNew && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--accent-primary)',
          boxShadow: 'var(--shadow-glow)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PlusCircle size={18} color="var(--accent-primary)" /> Registrar Nueva Sede
            </h3>
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className="btn btn-ghost"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
            >
              Cancelar
            </button>
          </div>
          <form onSubmit={handleCreateNewLot} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Nombre de la Sede</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Ej. Estacionamiento Altamira"
                value={newLotName}
                onChange={(e) => setNewLotName(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Dirección (Opcional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Ej. Av. Luis Roche, Caracas"
                value={newLotAddress}
                onChange={(e) => setNewLotAddress(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating}
                className="btn btn-primary"
              >
                {creating ? 'Guardando...' : 'Crear Sede'}
              </button>
            </div>
          </form>
        </div>
      )}

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

      {!isEditable && (
        <div className="alert" style={{
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#fbbf24',
        }}>
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <span>Modo de solo lectura: Tu rol (OPERATOR) no tiene privilegios para modificar la configuración física del estacionamiento.</span>
        </div>
      )}

      {/* Formulario Principal de Configuración */}
      <form onSubmit={handleSave} style={{
        backgroundColor: 'var(--bg-card)',
        padding: '2rem',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}>
          
          {/* Nombre */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Building2 size={16} color="var(--accent-primary)" />
              Nombre del Estacionamiento *
            </label>
            <input
              type="text"
              required
              disabled={!isEditable}
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Estacionamiento Chacao"
            />
          </div>

          {/* Dirección */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <MapPin size={16} color="var(--accent-secondary)" />
              Dirección
            </label>
            <input
              type="text"
              disabled={!isEditable}
              className="input-field"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej. Calle Páez, Torre Financiera, Nivel PB"
            />
          </div>

          {/* Teléfono */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Phone size={16} color="var(--status-success)" />
              Teléfono de Contacto
            </label>
            <input
              type="tel"
              disabled={!isEditable}
              className="input-field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej. +58 412 1234567"
            />
          </div>

          {/* Email */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Mail size={16} color="var(--status-info)" />
              Correo Electrónico
            </label>
            <input
              type="email"
              disabled={!isEditable}
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ej. chacao@parkingve.com"
            />
          </div>

          {/* Moneda */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <DollarSign size={16} color="#fbbf24" />
              Moneda Principal
            </label>
            <select
              aria-label="Moneda Principal"
              disabled={!isEditable}
              className="input-field"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              style={{ cursor: isEditable ? 'pointer' : 'default' }}
            >
              <option value="USD">USD ($) — Dólares Americanos (Predeterminada)</option>
              <option value="VES">VES (Bs.) — Bolívares</option>
              <option value="EUR">EUR (€) — Euros</option>
            </select>
          </div>

          {/* Zona Horaria */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={16} color="var(--text-secondary)" />
              Zona Horaria
            </label>
            <select
              aria-label="Zona Horaria"
              disabled={!isEditable}
              className="input-field"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{ cursor: isEditable ? 'pointer' : 'default' }}
            >
              <option value="America/Caracas">America/Caracas (UTC -4) [Venezuela]</option>
              <option value="America/Bogota">America/Bogota (UTC -5) [Colombia]</option>
              <option value="America/Panama">America/Panama (UTC -5)</option>
              <option value="America/Miami">America/Miami (UTC -4 / -5)</option>
            </select>
          </div>

        </div>

        {/* Acciones */}
        {isEditable && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border-subtle)',
            marginTop: '0.5rem',
          }}>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ minWidth: '180px' }}
            >
              {saving ? 'Guardando...' : (
                <>
                  <Save size={18} /> Guardar Cambios
                </>
              )}
            </button>
          </div>
        )}
      </form>

    </div>
  );
};
