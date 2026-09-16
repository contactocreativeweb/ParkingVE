import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  PlusCircle, 
  Edit2, 
  Check, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  RefreshCw, 
  Tag, 
  Power,
  Sparkles,
  Layers
} from 'lucide-react';
import type { AdditionalService } from '../../types/database';

export const AdditionalServicesSettings: React.FC = () => {
  const { currentParkingLot, role } = useAuth();
  const isEditable = role === 'OWNER' || role === 'ADMIN';

  const [services, setServices] = useState<AdditionalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados para Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<AdditionalService | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');

  const currency = currentParkingLot?.currency_code || 'USD';

  const loadServices = async () => {
    if (!currentParkingLot) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data, error } = await supabase
        .from('additional_services')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setServices((data || []) as AdditionalService[]);
    } catch (err: any) {
      console.error('Error fetching additional services:', err);
      setErrorMsg(err.message || 'Error al cargar los servicios adicionales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, [currentParkingLot?.id]);

  const openCreateModal = () => {
    setEditingService(null);
    setFormName('');
    setFormPrice('1.00');
    setIsModalOpen(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const openEditModal = (service: AdditionalService) => {
    setEditingService(service);
    setFormName(service.name);
    setFormPrice(Number(service.price).toFixed(2));
    setIsModalOpen(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParkingLot || !isEditable) return;

    const trimmedName = formName.trim();
    const priceNum = parseFloat(formPrice);

    if (!trimmedName) {
      setErrorMsg('El nombre del servicio no puede estar vacío');
      return;
    }

    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMsg('El precio debe ser un número válido igual o mayor a 0');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      if (editingService) {
        // Actualizar servicio existente
        const { error } = await supabase
          .from('additional_services')
          .update({
            name: trimmedName,
            price: priceNum,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingService.id);

        if (error) throw error;
        setSuccessMsg(`Servicio "${trimmedName}" actualizado correctamente.`);
      } else {
        // Crear nuevo servicio
        const { error } = await supabase
          .from('additional_services')
          .insert({
            parking_lot_id: currentParkingLot.id,
            name: trimmedName,
            price: priceNum,
            currency_code: currency,
            is_active: true,
          });

        if (error) throw error;
        setSuccessMsg(`Servicio "${trimmedName}" creado correctamente.`);
      }

      setIsModalOpen(false);
      await loadServices();
    } catch (err: any) {
      console.error('Error saving additional service:', err);
      setErrorMsg(err.message || 'Error al guardar el servicio');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (service: AdditionalService) => {
    if (!isEditable) return;
    try {
      const newStatus = !service.is_active;
      const { error } = await supabase
        .from('additional_services')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', service.id);

      if (error) throw error;
      setSuccessMsg(`Servicio "${service.name}" ${newStatus ? 'activado' : 'desactivado'}.`);
      await loadServices();
    } catch (err: any) {
      console.error('Error toggling service status:', err);
      setErrorMsg(err.message || 'Error al cambiar el estado del servicio');
    }
  };

  const handleSeedDefaults = async () => {
    if (!currentParkingLot || !isEditable) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const defaultServices = [
        { parking_lot_id: currentParkingLot.id, name: 'Casco', price: 1.0, currency_code: currency, is_active: true },
        { parking_lot_id: currentParkingLot.id, name: 'Lavado', price: 5.0, currency_code: currency, is_active: true },
        { parking_lot_id: currentParkingLot.id, name: 'Aspirado', price: 3.0, currency_code: currency, is_active: true },
      ];

      const { error } = await supabase.from('additional_services').insert(defaultServices);
      if (error) throw error;

      setSuccessMsg('Servicios de ejemplo (Casco, Lavado, Aspirado) creados.');
      await loadServices();
    } catch (err: any) {
      console.error('Error seeding default services:', err);
      setErrorMsg(err.message || 'Error al inicializar servicios predeterminados');
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
        <Layers size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3>Selecciona un estacionamiento para gestionar sus servicios</h3>
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
            <span className="badge badge-admin">FASE 6: SERVICIOS ADICIONALES</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Servicios Adicionales</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Configura servicios opcionales (Casco, Lavado, etc.) que el operador puede añadir a cada vehículo.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={loadServices}
            disabled={loading}
            className="btn btn-secondary"
            title="Recargar servicios"
            style={{ fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {isEditable && (
            <button
              type="button"
              onClick={openCreateModal}
              className="btn btn-primary"
              style={{ fontSize: '0.875rem' }}
            >
              <PlusCircle size={16} /> Crear Servicio
            </button>
          )}
        </div>
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
          <span>Modo de consulta: Tu rol (OPERATOR) permite ver los servicios activos pero no modificarlos ni crearlos.</span>
        </div>
      )}

      {/* Modal / Formulario de Creación y Edición */}
      {isModalOpen && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--accent-primary)',
          boxShadow: 'var(--shadow-glow)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag size={18} color="var(--accent-primary)" />
              {editingService ? 'Editar Servicio Adicional' : 'Nuevo Servicio Adicional'}
            </h3>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn btn-ghost"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveService} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nombre del Servicio *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="Ej. Casco, Lavado, etc."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Precio ({currency}) *</label>
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
                    className="input-field"
                    style={{ paddingLeft: '2rem' }}
                    placeholder="1.00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                  />
                </div>
              </div>

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Guardando...' : (
                  <>
                    <Check size={16} /> {editingService ? 'Actualizar' : 'Crear'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de Servicios */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Cargando servicios adicionales...
          </div>
        ) : services.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <Layers size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.15rem' }}>No hay servicios adicionales registrados</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.35rem', marginBottom: '1.25rem' }}>
              Añade servicios como custodia de casco, autolavado o servicios especiales.
            </p>
            {isEditable && (
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={saving}
                className="btn btn-secondary"
                style={{ fontSize: '0.875rem' }}
              >
                <Sparkles size={16} color="var(--accent-primary)" /> Cargar servicios sugeridos (Casco $1, Lavado $5)
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {services.map((service, index) => (
              <div
                key={service.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.15rem 1.5rem',
                  borderBottom: index < services.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  backgroundColor: service.is_active ? 'transparent' : 'rgba(0,0,0,0.2)',
                  opacity: service.is_active ? 1 : 0.6,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: service.is_active ? 'var(--bg-badge)' : 'var(--bg-input)',
                    color: service.is_active ? 'var(--accent-primary)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Tag size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                        {service.name}
                      </span>
                      {!service.is_active && (
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-full)',
                        }}>
                          DESACTIVADO
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Servicio adicional por operación
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '1.2rem',
                      fontWeight: 800,
                      color: service.is_active ? 'var(--status-success)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      ${Number(service.price).toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                      {service.currency_code}
                    </span>
                  </div>

                  {isEditable && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => openEditModal(service)}
                        className="btn btn-ghost"
                        title="Editar servicio"
                        style={{ padding: '0.45rem', borderRadius: 'var(--radius-md)' }}
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(service)}
                        className="btn btn-ghost"
                        title={service.is_active ? 'Desactivar servicio' : 'Activar servicio'}
                        style={{
                          padding: '0.45rem',
                          borderRadius: 'var(--radius-md)',
                          color: service.is_active ? 'var(--status-success)' : 'var(--text-muted)',
                        }}
                      >
                        <Power size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
