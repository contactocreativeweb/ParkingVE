import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  DollarSign, 
  Car, 
  Bike, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  RefreshCw,
  Tag
} from 'lucide-react';
import type { Tariff, VehicleType } from '../../types/database';

interface TariffFormState {
  dailyPrice: string;
  lostTicketPrice: string;
}

export const TariffSettings: React.FC = () => {
  const { currentParkingLot, role } = useAuth();
  const isEditable = role === 'OWNER' || role === 'ADMIN';

  const [tariffs, setTariffs] = useState<Record<VehicleType, TariffFormState>>({
    CAR: { dailyPrice: '0.00', lostTicketPrice: '0.00' },
    MOTORCYCLE: { dailyPrice: '0.00', lostTicketPrice: '0.00' },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currency = currentParkingLot?.currency_code || 'USD';

  const loadTariffs = async () => {
    if (!currentParkingLot) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase
        .from('tariffs')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id);

      if (error) throw error;

      const loadedTariffs: Record<VehicleType, TariffFormState> = {
        CAR: { dailyPrice: '2.00', lostTicketPrice: '10.00' },
        MOTORCYCLE: { dailyPrice: '1.00', lostTicketPrice: '5.00' },
      };

      if (data && data.length > 0) {
        data.forEach((t: Tariff) => {
          if (t.vehicle_type in loadedTariffs) {
            loadedTariffs[t.vehicle_type] = {
              dailyPrice: Number(t.daily_price).toFixed(2),
              lostTicketPrice: Number(t.lost_ticket_price).toFixed(2),
            };
          }
        });
      }

      setTariffs(loadedTariffs);
    } catch (err: any) {
      console.error('Error fetching tariffs:', err);
      setErrorMsg(err.message || 'Error al cargar las tarifas del estacionamiento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTariffs();
  }, [currentParkingLot?.id]);

  const handleChange = (vehicleType: VehicleType, field: keyof TariffFormState, value: string) => {
    setTariffs((prev) => ({
      ...prev,
      [vehicleType]: {
        ...prev[vehicleType],
        [field]: value,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParkingLot || !isEditable) return;

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const updates = (['CAR', 'MOTORCYCLE'] as VehicleType[]).map((type) => {
        const item = tariffs[type];
        return {
          parking_lot_id: currentParkingLot.id,
          vehicle_type: type,
          daily_price: Math.max(0, parseFloat(item.dailyPrice) || 0),
          lost_ticket_price: Math.max(0, parseFloat(item.lostTicketPrice) || 0),
          currency_code: currency,
          is_active: true,
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from('tariffs')
        .upsert(updates, { onConflict: 'parking_lot_id,vehicle_type' });

      if (error) throw error;

      setSuccessMsg('Tarifas de Carro y Moto actualizadas exitosamente en la base de datos.');
      await loadTariffs();
    } catch (err: any) {
      console.error('Error saving tariffs:', err);
      setErrorMsg(err.message || 'Error al guardar las tarifas.');
    } finally {
      setSaving(false);
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
        <DollarSign size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3>Selecciona un estacionamiento para ver o editar sus tarifas</h3>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
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
            <span className="badge badge-admin">FASE 5: TARIFAS</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Configuración de Tarifas</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Tarifas base aplicadas por tipo de vehículo. Todos los precios son administrados dinámicamente.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTariffs}
          disabled={loading}
          className="btn btn-secondary"
          title="Recargar tarifas desde la base de datos"
          style={{ fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Recargar
        </button>
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

      {!isEditable && (
        <div className="alert" style={{
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#fbbf24',
        }}>
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <span>Modo de consulta: Tu rol (OPERATOR) no permite modificar las tarifas oficiales.</span>
        </div>
      )}

      {/* Formulario de Tarifas */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}>
          
          {/* Tarjeta CARRO */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.75rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Car size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Tarifa CARRO</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Vehículos estándar y camionetas</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Tag size={15} color="var(--accent-primary)" />
                Tarifa Diaria ({currency})
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  disabled={!isEditable || loading}
                  className="input-field"
                  style={{ paddingLeft: '2rem' }}
                  value={tariffs.CAR.dailyPrice}
                  onChange={(e) => handleChange('CAR', 'dailyPrice', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={15} color="#fbbf24" />
                Ticket Perdido ({currency})
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  disabled={!isEditable || loading}
                  className="input-field"
                  style={{ paddingLeft: '2rem' }}
                  value={tariffs.CAR.lostTicketPrice}
                  onChange={(e) => handleChange('CAR', 'lostTicketPrice', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tarjeta MOTO */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            padding: '1.75rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                color: 'var(--accent-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Bike size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', margin: 0 }}>Tarifa MOTO</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Motocicletas y scooters</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Tag size={15} color="var(--accent-secondary)" />
                Tarifa Diaria ({currency})
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  disabled={!isEditable || loading}
                  className="input-field"
                  style={{ paddingLeft: '2rem' }}
                  value={tariffs.MOTORCYCLE.dailyPrice}
                  onChange={(e) => handleChange('MOTORCYCLE', 'dailyPrice', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={15} color="#fbbf24" />
                Ticket Perdido ({currency})
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  disabled={!isEditable || loading}
                  className="input-field"
                  style={{ paddingLeft: '2rem' }}
                  value={tariffs.MOTORCYCLE.lostTicketPrice}
                  onChange={(e) => handleChange('MOTORCYCLE', 'lostTicketPrice', e.target.value)}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Botón Guardar */}
        {isEditable && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '1rem',
          }}>
            <button
              type="submit"
              disabled={saving || loading}
              className="btn btn-primary"
              style={{ minWidth: '180px' }}
            >
              {saving ? 'Guardando tarifas...' : (
                <>
                  <Save size={18} /> Guardar Tarifas
                </>
              )}
            </button>
          </div>
        )}

      </form>
    </div>
  );
};
