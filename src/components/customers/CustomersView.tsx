import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Users, 
  Search, 
  UserPlus, 
  Edit3, 
  Car, 
  Bike, 
  Phone, 
  Mail, 
  IdCard, 
  History, 
  Check, 
  X, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  Calendar
} from 'lucide-react';
import type { Customer, Vehicle, VehicleType, ParkingSession } from '../../types/database';

interface CustomerWithVehicles extends Customer {
  vehicles?: Vehicle[];
}

export const CustomersView: React.FC = () => {
  const { currentParkingLot } = useAuth();

  const [customers, setCustomers] = useState<CustomerWithVehicles[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Form Fields Cliente
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [identification, setIdentification] = useState('');
  const [notes, setNotes] = useState('');

  // Form Fields Vehículo inicial (opcional al crear)
  const [addInitialVehicle, setAddInitialVehicle] = useState(false);
  const [vehPlate, setVehPlate] = useState('');
  const [vehType, setVehType] = useState<VehicleType>('CAR');
  const [vehBrand, setVehBrand] = useState('');
  const [vehModel, setVehModel] = useState('');
  const [vehColor, setVehColor] = useState('');

  // Detalle / Historial
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithVehicles | null>(null);
  const [customerSessions, setCustomerSessions] = useState<ParkingSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [detailTab, setDetailTab] = useState<'vehicles' | 'history'>('vehicles');

  // Agregar vehículo a cliente existente
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState<VehicleType>('CAR');
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newColor, setNewColor] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);

  const normalizePlate = (plate: string) => {
    return plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  };

  const loadCustomers = async () => {
    if (!currentParkingLot) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Obtener clientes del estacionamiento
      const { data: customersData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id)
        .order('created_at', { ascending: false });

      if (custErr) throw custErr;

      // 2. Obtener vehículos del estacionamiento
      const { data: vehiclesData, error: vehErr } = await supabase
        .from('vehicles')
        .select('*')
        .eq('parking_lot_id', currentParkingLot.id);

      if (vehErr) throw vehErr;

      // Agrupar vehículos por cliente
      const vehiclesMap = new Map<string, Vehicle[]>();
      (vehiclesData || []).forEach((v: Vehicle) => {
        if (v.customer_id) {
          const list = vehiclesMap.get(v.customer_id) || [];
          list.push(v);
          vehiclesMap.set(v.customer_id, list);
        }
      });

      const fullList: CustomerWithVehicles[] = (customersData || []).map((c: Customer) => ({
        ...c,
        vehicles: vehiclesMap.get(c.id) || [],
      }));

      setCustomers(fullList);

      // Actualizar cliente seleccionado si está abierto
      if (selectedCustomer) {
        const updated = fullList.find((c) => c.id === selectedCustomer.id);
        if (updated) setSelectedCustomer(updated);
      }
    } catch (err: any) {
      console.error('Error fetching customers:', err);
      setErrorMsg(err.message || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [currentParkingLot?.id]);

  const openCreate = () => {
    setEditingCustomer(null);
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setIdentification('');
    setNotes('');
    setAddInitialVehicle(false);
    setVehPlate('');
    setVehType('CAR');
    setVehBrand('');
    setVehModel('');
    setVehColor('');
    setIsFormOpen(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFirstName(customer.first_name || '');
    setLastName(customer.last_name || '');
    setPhone(customer.phone || '');
    setEmail(customer.email || '');
    setIdentification(customer.identification_number || '');
    setNotes(customer.notes || '');
    setAddInitialVehicle(false);
    setIsFormOpen(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParkingLot) return;

    setSavingCustomer(true);
    setErrorMsg(null);

    try {
      if (editingCustomer) {
        // Actualizar cliente existente
        const { error } = await supabase
          .from('customers')
          .update({
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
            identification_number: identification.trim() || null,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCustomer.id);

        if (error) throw error;
        setSuccessMsg('Cliente actualizado correctamente.');
      } else {
        // Crear nuevo cliente
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({
            parking_lot_id: currentParkingLot.id,
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
            identification_number: identification.trim() || null,
            notes: notes.trim() || null,
            is_active: true,
          })
          .select()
          .single();

        if (custErr) throw custErr;

        // Si se indicó vehículo inicial, registrarlo
        if (addInitialVehicle && vehPlate.trim()) {
          const cleanPlate = normalizePlate(vehPlate);
          const { error: vehErr } = await supabase.from('vehicles').insert({
            parking_lot_id: currentParkingLot.id,
            customer_id: newCust.id,
            plate: cleanPlate,
            vehicle_type: vehType,
            brand: vehBrand.trim() || null,
            model: vehModel.trim() || null,
            color: vehColor.trim() || null,
          });

          if (vehErr) {
            console.warn('Vehicle creation note:', vehErr.message);
          }
        }

        setSuccessMsg('Cliente registrado exitosamente.');
      }

      setIsFormOpen(false);
      await loadCustomers();
    } catch (err: any) {
      console.error('Error saving customer:', err);
      setErrorMsg(err.message || 'Error al guardar cliente');
    } finally {
      setSavingCustomer(false);
    }
  };

  const openCustomerDetail = async (customer: CustomerWithVehicles) => {
    setSelectedCustomer(customer);
    setDetailTab('vehicles');
    setIsAddingVehicle(false);
    setLoadingHistory(true);

    try {
      const { data, error } = await supabase
        .from('parking_sessions')
        .select('*')
        .eq('parking_lot_id', currentParkingLot!.id)
        .eq('customer_id', customer.id)
        .order('entry_at', { ascending: false });

      if (error) throw error;
      setCustomerSessions((data || []) as ParkingSession[]);
    } catch (err: any) {
      console.error('Error fetching customer history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentParkingLot || !selectedCustomer || !newPlate.trim()) return;

    setSavingVehicle(true);
    setErrorMsg(null);

    try {
      const cleanPlate = normalizePlate(newPlate);
      const { error } = await supabase.from('vehicles').insert({
        parking_lot_id: currentParkingLot.id,
        customer_id: selectedCustomer.id,
        plate: cleanPlate,
        vehicle_type: newType,
        brand: newBrand.trim() || null,
        model: newModel.trim() || null,
        color: newColor.trim() || null,
      });

      if (error) throw error;

      setIsAddingVehicle(false);
      setNewPlate('');
      setNewBrand('');
      setNewModel('');
      setNewColor('');
      setSuccessMsg(`Vehículo con placa ${cleanPlate} registrado con éxito.`);
      await loadCustomers();
    } catch (err: any) {
      console.error('Error adding vehicle:', err);
      setErrorMsg(err.message || 'Error al registrar vehículo.');
    } finally {
      setSavingVehicle(false);
    }
  };

  // Filtrado por nombre, teléfono, email y matrícula
  const filteredCustomers = customers.filter((c) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    const phoneMatch = (c.phone || '').toLowerCase().includes(term);
    const emailMatch = (c.email || '').toLowerCase().includes(term);
    const idMatch = (c.identification_number || '').toLowerCase().includes(term);
    const plateMatch = (c.vehicles || []).some((v) =>
      v.plate.toLowerCase().includes(term.replace(/[^a-z0-9]/g, ''))
    );

    return fullName.includes(term) || phoneMatch || emailMatch || idMatch || plateMatch;
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
        <Users size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3>Selecciona un estacionamiento para gestionar clientes</h3>
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
            <span className="badge badge-operator">FASE 7: CLIENTES</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Gestión de Clientes</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Base de clientes y vehículos asignados de forma independiente a este estacionamiento.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={loadCustomers}
            disabled={loading}
            className="btn btn-secondary"
            title="Recargar clientes"
            style={{ fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="btn btn-primary"
            style={{ fontSize: '0.875rem' }}
          >
            <UserPlus size={16} /> Crear Cliente
          </button>
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

      {/* Barra de Búsqueda (sección 55: nombre, teléfono, email, matrícula) */}
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
          placeholder="Buscar cliente por nombre, teléfono, email o matrícula..."
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

      {/* Modal / Formulario de Creación y Edición de Cliente */}
      {isFormOpen && (
        <div style={{
          padding: '1.75rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--accent-primary)',
          boxShadow: 'var(--shadow-glow)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={20} color="var(--accent-primary)" />
              {editingCustomer ? 'Editar Datos del Cliente' : 'Registrar Nuevo Cliente'}
            </h3>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="btn btn-ghost"
              style={{ padding: '0.25rem 0.5rem' }}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSaveCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Nombre *</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="Ej. Juan"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Apellido</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Pérez"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Cédula / Documento (Opcional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. V-18234567"
                  value={identification}
                  onChange={(e) => setIdentification(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Teléfono</label>
                <input
                  type="tel"
                  className="input-field"
                  placeholder="Ej. +58 412 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Correo Electrónico</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="Ej. cliente@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Notas / Observaciones</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Ej. Cliente frecuente / puesto fijo"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

            </div>

            {/* Sección de Vehículo inicial al crear */}
            {!editingCustomer && (
              <div style={{
                padding: '1.25rem',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}>
                  <input
                    type="checkbox"
                    checked={addInitialVehicle}
                    onChange={(e) => setAddInitialVehicle(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                  />
                  Registrar vehículo inicial para este cliente
                </label>

                {addInitialVehicle && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem',
                    marginTop: '1rem',
                  }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Matrícula / Placa *</label>
                      <input
                        type="text"
                        required={addInitialVehicle}
                        className="input-field"
                        placeholder="Ej. ABC123"
                        value={vehPlate}
                        onChange={(e) => setVehPlate(normalizePlate(e.target.value))}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Tipo de Vehículo</label>
                      <select
                        aria-label="Tipo de Vehículo"
                        className="input-field"
                        value={vehType}
                        onChange={(e) => setVehType(e.target.value as VehicleType)}
                      >
                        <option value="CAR">Carro / Camioneta</option>
                        <option value="MOTORCYCLE">Moto / Scooter</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Marca</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ej. Toyota"
                        value={vehBrand}
                        onChange={(e) => setVehBrand(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Modelo</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ej. Corolla"
                        value={vehModel}
                        onChange={(e) => setVehModel(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Color</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Ej. Blanco"
                        value={vehColor}
                        onChange={(e) => setVehColor(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingCustomer}
                className="btn btn-primary"
              >
                {savingCustomer ? 'Guardando...' : (
                  <>
                    <Check size={16} /> {editingCustomer ? 'Guardar Cambios' : 'Registrar Cliente'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal / Drawer de Detalle de Cliente (Vehículos e Historial) */}
      {selectedCustomer && (
        <div style={{
          padding: '1.75rem',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--accent-secondary)',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <span className="badge badge-operator" style={{ marginBottom: '0.35rem' }}>Detalle de Cliente</span>
              <h3 style={{ fontSize: '1.4rem', margin: 0 }}>
                {selectedCustomer.first_name} {selectedCustomer.last_name || ''}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {selectedCustomer.phone && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Phone size={14} color="var(--status-success)" /> {selectedCustomer.phone}
                  </span>
                )}
                {selectedCustomer.email && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Mail size={14} color="var(--status-info)" /> {selectedCustomer.email}
                  </span>
                )}
                {selectedCustomer.identification_number && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <IdCard size={14} color="#fbbf24" /> {selectedCustomer.identification_number}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="btn btn-ghost"
              style={{ padding: '0.35rem 0.65rem' }}
            >
              <X size={18} /> Cerrar
            </button>
          </div>

          {/* Selector de sub-pestaña */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setDetailTab('vehicles')}
              style={{
                padding: '0.6rem 1.1rem',
                border: 'none',
                borderBottom: detailTab === 'vehicles' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: detailTab === 'vehicles' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Car size={16} /> Vehículos Registrados ({selectedCustomer.vehicles?.length || 0})
            </button>

            <button
              type="button"
              onClick={() => setDetailTab('history')}
              style={{
                padding: '0.6rem 1.1rem',
                border: 'none',
                borderBottom: detailTab === 'history' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: detailTab === 'history' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <History size={16} /> Historial de Entradas/Salidas ({customerSessions.length})
            </button>
          </div>

          {/* Pestaña: Vehículos */}
          {detailTab === 'vehicles' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Vehículos asociados a este cliente:</span>
                {!isAddingVehicle && (
                  <button
                    type="button"
                    onClick={() => setIsAddingVehicle(true)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  >
                    <Plus size={14} /> Asociar Vehículo
                  </button>
                )}
              </div>

              {isAddingVehicle && (
                <form onSubmit={handleAddVehicle} style={{
                  backgroundColor: 'var(--bg-input)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}>
                  <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Agregar Nuevo Vehículo</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Placa *</label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        placeholder="Ej. ABC123"
                        value={newPlate}
                        onChange={(e) => setNewPlate(normalizePlate(e.target.value))}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Tipo</label>
                      <select
                        aria-label="Tipo"
                        className="input-field"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as VehicleType)}
                      >
                        <option value="CAR">Carro</option>
                        <option value="MOTORCYCLE">Moto</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Marca</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Toyota"
                        value={newBrand}
                        onChange={(e) => setNewBrand(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Modelo</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Corolla"
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Color</label>
                      <input
                        type="text"
                        className="input-field"
                        placeholder="Gris"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setIsAddingVehicle(false)}
                      className="btn btn-ghost"
                      style={{ fontSize: '0.85rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingVehicle}
                      className="btn btn-primary"
                      style={{ fontSize: '0.85rem' }}
                    >
                      {savingVehicle ? 'Guardando...' : 'Asociar Vehículo'}
                    </button>
                  </div>
                </form>
              )}

              {(!selectedCustomer.vehicles || selectedCustomer.vehicles.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Este cliente no tiene ningún vehículo registrado aún.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                  {selectedCustomer.vehicles.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        padding: '1rem 1.25rem',
                        backgroundColor: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        backgroundColor: v.vehicle_type === 'CAR' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                        color: v.vehicle_type === 'CAR' ? 'var(--accent-primary)' : 'var(--accent-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {v.vehicle_type === 'CAR' ? <Car size={20} /> : <Bike size={20} />}
                      </div>
                      <div>
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 800,
                          fontSize: '1.15rem',
                          color: 'var(--text-primary)',
                          letterSpacing: '0.05em',
                        }}>
                          {v.plate}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {[v.brand, v.model, v.color].filter(Boolean).join(' • ') || (v.vehicle_type === 'CAR' ? 'Carro' : 'Moto')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pestaña: Historial de Sesiones */}
          {detailTab === 'history' && (
            <div>
              {loadingHistory ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Cargando historial de operaciones...
                </div>
              ) : customerSessions.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No hay operaciones registradas para este cliente aún.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {customerSessions.map((session) => (
                    <div
                      key={session.id}
                      style={{
                        padding: '1rem 1.25rem',
                        backgroundColor: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--bg-card)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                        }}>
                          {session.plate_snapshot}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Calendar size={13} /> Entrada: {new Date(session.entry_at).toLocaleString()}
                          </span>
                          {session.exit_at && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}>
                              Salida: {new Date(session.exit_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          fontSize: '1.05rem',
                          color: session.status === 'COMPLETED' ? 'var(--status-success)' : 'var(--accent-primary)',
                        }}>
                          ${Number(session.total_amount).toFixed(2)}
                        </div>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: session.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                          color: session.status === 'COMPLETED' ? '#34d399' : '#818cf8',
                        }}>
                          {session.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Lista Principal de Clientes */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Cargando base de clientes...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <Users size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.15rem' }}>
              {searchTerm ? 'No se encontraron clientes coincidentes' : 'No hay clientes registrados en este estacionamiento'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.35rem', marginBottom: '1.25rem' }}>
              {searchTerm ? 'Prueba con otro término de búsqueda (nombre, teléfono o placa)' : 'Comienza registrando tu primer cliente o regístralo directamente en la entrada.'}
            </p>
            {!searchTerm && (
              <button
                type="button"
                onClick={openCreate}
                className="btn btn-primary"
                style={{ fontSize: '0.875rem' }}
              >
                <UserPlus size={16} /> Crear Primer Cliente
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredCustomers.map((customer, index) => (
              <div
                key={customer.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.15rem 1.5rem',
                  borderBottom: index < filteredCustomers.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-badge)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                  }}>
                    {customer.first_name ? customer.first_name[0].toUpperCase() : 'C'}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        {customer.first_name} {customer.last_name || ''}
                      </span>
                      {customer.identification_number && (
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {customer.identification_number}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {customer.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Phone size={13} /> {customer.phone}
                        </span>
                      )}
                      {customer.email && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Mail size={13} /> {customer.email}
                        </span>
                      )}
                    </div>

                    {/* Vehículos del cliente */}
                    {customer.vehicles && customer.vehicles.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {customer.vehicles.map((v) => (
                          <span
                            key={v.id}
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              backgroundColor: 'var(--bg-input)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-subtle)',
                              padding: '0.15rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            {v.vehicle_type === 'CAR' ? <Car size={12} color="var(--accent-primary)" /> : <Bike size={12} color="var(--accent-secondary)" />}
                            {v.plate}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => openCustomerDetail(customer)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}
                  >
                    <History size={14} /> Vehículos & Historial
                  </button>

                  <button
                    type="button"
                    onClick={() => openEdit(customer)}
                    className="btn btn-ghost"
                    title="Editar cliente"
                    style={{ padding: '0.45rem', borderRadius: 'var(--radius-md)' }}
                  >
                    <Edit3 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
