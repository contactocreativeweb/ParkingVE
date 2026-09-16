import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginCard } from './components/auth/LoginCard';
import { UserHeader } from './components/auth/UserHeader';
import { TenantSetup } from './components/auth/TenantSetup';
import { ParkingLotSettings } from './components/settings/ParkingLotSettings';
import { 
  ShieldCheck, 
  Building2, 
  MapPin, 
  UserCheck, 
  Sparkles, 
  ArrowRight,
  Settings,
  LayoutDashboard
} from 'lucide-react';

type TabType = 'dashboard' | 'parking-settings';

const MainLayout: React.FC = () => {
  const { user, organization, role, currentParkingLot, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('parking-settings');

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--accent-primary)',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Cargando entorno de ParkingVE...
        </span>
      </div>
    );
  }

  // 1. Si no hay sesión: Mostrar Pantalla de Login / Registro / Recuperación
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'radial-gradient(ellipse at 50% 20%, rgba(99, 102, 241, 0.15), transparent 70%), var(--bg-main)',
      }}>
        <LoginCard />
      </div>
    );
  }

  // 2. Si el usuario está autenticado pero no pertenece a ninguna empresa/organización: Asistente inicial
  if (!organization) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <UserHeader />
        <div style={{ flex: 1, padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TenantSetup />
        </div>
      </div>
    );
  }

  // 3. Usuario autenticado con organización y estacionamiento
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-main)' }}>
      <UserHeader />

      {/* Sub-barra de navegación rápida */}
      <nav style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.5rem 1.25rem',
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          overflowX: 'auto',
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('parking-settings')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'parking-settings' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'parking-settings' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Settings size={16} /> Mi Estacionamiento (Fase 4)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'dashboard' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'dashboard' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <LayoutDashboard size={16} /> Resumen General
          </button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: '2rem 1.25rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          {activeTab === 'parking-settings' && (
            <ParkingLotSettings />
          )}

          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Bienvenida y Estado del Aislamiento */}
              <div style={{
                padding: '2rem',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <span className="badge badge-operator" style={{ marginBottom: '0.5rem' }}>
                      <ShieldCheck size={14} /> FASE 3 & 4 OPERATIVAS
                    </span>
                    <h1 style={{ fontSize: '1.85rem', margin: '0.25rem 0' }}>
                      Espacio de Trabajo Conectado
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                      Sesión validada con Supabase Auth. Aislamiento multi-tenant y reglas RLS en vigor.
                    </p>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--status-success)',
                      boxShadow: '0 0 10px var(--status-success)',
                    }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>PWA En línea & Instalable</span>
                  </div>
                </div>

                {/* Tarjetas de Contexto Activo: Usuario -> Organización -> Estacionamiento -> Rol */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  marginTop: '0.5rem',
                }}>
                  <div style={{
                    padding: '1.25rem',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      <Building2 size={16} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Empresa</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                      {organization.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      País: {organization.country_code} • Moneda: {organization.currency_code}
                    </div>
                  </div>

                  <div style={{
                    padding: '1.25rem',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      <MapPin size={16} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Sede Activa</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                      {currentParkingLot ? currentParkingLot.name : 'Sin sede asignada'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Timezone: {currentParkingLot?.timezone || 'America/Caracas'}
                    </div>
                  </div>

                  <div style={{
                    padding: '1.25rem',
                    backgroundColor: 'var(--bg-input)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      <UserCheck size={16} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Nivel de Acceso</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                      Rol: {role}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {role === 'OWNER' && 'Control total de la organización y sedes'}
                      {role === 'ADMIN' && 'Administración operativa y tarifas'}
                      {role === 'OPERATOR' && 'Operaciones rápidas de entrada y salida'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Siguiente Fase en el Documento Maestro */}
              <div style={{
                padding: '1.75rem',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px dashed var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Sparkles size={18} color="var(--accent-primary)" />
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>Siguiente etapa: FASE 5 — Tarifas</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    Configuración de precios de tarifa diaria y ticket perdido para CARRO y MOTO con actualización en tiempo real.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                  <span>Preparado</span>
                  <ArrowRight size={16} />
                </div>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

export default App;
