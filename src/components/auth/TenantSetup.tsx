import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Building, CheckCircle2, AlertCircle } from 'lucide-react';

export const TenantSetup: React.FC = () => {
  const { user, refreshTenantContext } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [parkingName, setParkingName] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);

    try {
      // 1. Crear Organización
      const { data: orgData, error: orgErr } = await supabase
        .from('organizations')
        .insert({
          name: orgName.trim(),
          country_code: 'VE',
          currency_code: 'USD',
          timezone: 'America/Caracas',
          is_active: true,
        })
        .select()
        .single();

      if (orgErr) throw orgErr;

      // 2. Asociar Usuario como OWNER
      const { error: memberErr } = await supabase
        .from('organization_members')
        .insert({
          organization_id: orgData.id,
          user_id: user.id,
          role: 'OWNER',
          is_active: true,
        });

      if (memberErr) throw memberErr;

      // 3. Crear el primer Estacionamiento
      const { data: parkingData, error: parkingErr } = await supabase
        .from('parking_lots')
        .insert({
          organization_id: orgData.id,
          name: parkingName.trim() || 'Sede Principal',
          address: address.trim() || null,
          timezone: 'America/Caracas',
          currency_code: 'USD',
          is_active: true,
        })
        .select()
        .single();

      if (parkingErr) throw parkingErr;

      // 4. Asignar usuario al estacionamiento
      await supabase.from('parking_lot_members').insert({
        parking_lot_id: parkingData.id,
        user_id: user.id,
      });

      // 5. Crear tarifas por defecto (Carro y Moto) según la regla de la guía
      await supabase.from('tariffs').insert([
        {
          parking_lot_id: parkingData.id,
          vehicle_type: 'CAR',
          daily_price: 2.0,
          lost_ticket_price: 10.0,
          currency_code: 'USD',
          is_active: true,
        },
        {
          parking_lot_id: parkingData.id,
          vehicle_type: 'MOTORCYCLE',
          daily_price: 1.0,
          lost_ticket_price: 5.0,
          currency_code: 'USD',
          is_active: true,
        },
      ]);

      // Refrescar el estado global de autenticación
      await refreshTenantContext();
    } catch (err: any) {
      console.error('Error during tenant setup:', err);
      setError(err.message || 'Error al configurar la empresa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      maxWidth: '520px',
      margin: '3rem auto',
      padding: '2.5rem',
      backgroundColor: 'var(--bg-card)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-lg)',
      textAlign: 'left',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
        }}>
          <Building size={28} color="#fff" />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Configuración Inicial de Empresa</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Para comenzar a operar en ParkingVE, define el nombre de tu empresa y el primer estacionamiento.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSetup}>
        <div className="form-group">
          <label className="form-label">Nombre de la Empresa / Operadora</label>
          <input
            type="text"
            required
            className="input-field"
            placeholder="Ej. Estacionamientos Caracas 2026 C.A."
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Nombre del Estacionamiento (Sede)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              required
              className="input-field"
              placeholder="Ej. Estacionamiento Chacao"
              value={parkingName}
              onChange={(e) => setParkingName(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Dirección (Opcional)</label>
          <input
            type="text"
            className="input-field"
            placeholder="Ej. Av. Francisco de Miranda, Caracas"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '1rem' }}
        >
          {saving ? 'Configurando empresa...' : (
            <>
              <CheckCircle2 size={18} /> Iniciar Operaciones
            </>
          )}
        </button>
      </form>
    </div>
  );
};
