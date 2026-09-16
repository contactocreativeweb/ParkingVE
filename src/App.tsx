import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginCard } from './components/auth/LoginCard';
import { UserHeader } from './components/auth/UserHeader';
import { TenantSetup } from './components/auth/TenantSetup';
import { ParkingLotSettings } from './components/settings/ParkingLotSettings';
import { TariffSettings } from './components/settings/TariffSettings';
import { AdditionalServicesSettings } from './components/settings/AdditionalServicesSettings';
import { CustomersView } from './components/customers/CustomersView';
import { EntryView } from './components/operations/EntryView';
import { ActiveVehiclesView } from './components/operations/ActiveVehiclesView';
import { ExitView } from './components/operations/ExitView';
import { PaymentView } from './components/operations/PaymentView';
import { ReceiptUploadView } from './components/operations/ReceiptUploadView';
import { PaymentsReviewView } from './components/operations/PaymentsReviewView';
import { ReceiptView } from './components/operations/ReceiptView';
import { ShiftsView } from './components/operations/ShiftsView';
import { ReportsView } from './components/operations/ReportsView';
import { AuditLogView } from './components/operations/AuditLogView';
import { DashboardMVP } from './components/dashboard/DashboardMVP';
import { 
  Settings,
  DollarSign,
  Layers,
  Users,
  LogIn,
  LogOut,
  Car,
  CreditCard,
  UploadCloud,
  LayoutDashboard,
  ClipboardList,
  FileCheck,
  Vault,
  BarChart3,
  ScrollText
} from 'lucide-react';
import type { ParkingSession } from './types/database';

type TabType = 
  | 'dashboard' 
  | 'parking-settings' 
  | 'tariffs' 
  | 'services' 
  | 'customers' 
  | 'entry' 
  | 'active-vehicles' 
  | 'exit' 
  | 'payment'
  | 'receipts-upload'
  | 'payments-review'
  | 'receipts'
  | 'shifts'
  | 'reports'
  | 'audit';

const MainLayout: React.FC = () => {
  const { user, organization, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedExitSessionId, setSelectedExitSessionId] = useState<string | null>(null);
  const [paymentSession, setPaymentSession] = useState<ParkingSession | null>(null);
  const [uploadPaymentId, setUploadPaymentId] = useState<string | null>(null);

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
            onClick={() => setActiveTab('dashboard')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.95rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'dashboard' ? 'var(--accent-primary)' : 'var(--bg-input)',
              color: activeTab === 'dashboard' ? '#ffffff' : 'var(--text-primary)',
              boxShadow: activeTab === 'dashboard' ? 'var(--shadow-md)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <LayoutDashboard size={16} /> Dashboard (MVP)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'audit' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'audit' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <ScrollText size={16} /> Auditoría (Fase 17)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'reports' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'reports' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <BarChart3 size={16} /> Reportes (Fase 16)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shifts')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'shifts' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'shifts' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Vault size={16} /> Caja (Fase 15)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receipts')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'receipts' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'receipts' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <FileCheck size={16} /> Recibos (Fase 14)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments-review')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              backgroundColor: activeTab === 'payments-review' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'payments-review' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <ClipboardList size={16} /> Revisión (Fase 13)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receipts-upload')}
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
              backgroundColor: activeTab === 'receipts-upload' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'receipts-upload' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <UploadCloud size={16} /> Comprobante (Fase 12)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payment')}
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
              backgroundColor: activeTab === 'payment' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'payment' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <CreditCard size={16} /> Cobro / Pago (Fase 11)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('exit')}
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
              backgroundColor: activeTab === 'exit' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'exit' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <LogOut size={16} /> Salida (Fase 10)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('active-vehicles')}
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
              backgroundColor: activeTab === 'active-vehicles' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'active-vehicles' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Car size={16} /> Vehículos Dentro (Fase 9)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('entry')}
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
              backgroundColor: activeTab === 'entry' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'entry' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <LogIn size={16} /> Entrada (Fase 8)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('customers')}
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
              backgroundColor: activeTab === 'customers' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'customers' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={16} /> Clientes (Fase 7)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('services')}
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
              backgroundColor: activeTab === 'services' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'services' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={16} /> Servicios (Fase 6)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tariffs')}
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
              backgroundColor: activeTab === 'tariffs' ? 'var(--bg-badge)' : 'transparent',
              color: activeTab === 'tariffs' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            <DollarSign size={16} /> Tarifas (Fase 5)
          </button>

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
        </div>
      </nav>

      <main style={{ flex: 1, padding: '2rem 1.25rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          {activeTab === 'audit' && (
            <AuditLogView />
          )}

          {activeTab === 'reports' && (
            <ReportsView />
          )}

          {activeTab === 'shifts' && (
            <ShiftsView />
          )}

          {activeTab === 'receipts' && (
            <ReceiptView />
          )}

          {activeTab === 'payments-review' && (
            <PaymentsReviewView
              onPaymentApproved={(_pay) => {
                setActiveTab('receipts');
              }}
            />
          )}

          {activeTab === 'receipts-upload' && (
            <ReceiptUploadView
              initialPaymentId={uploadPaymentId}
              onReceiptUploaded={(rcId) => {
                console.log('Comprobante subido:', rcId);
              }}
            />
          )}

          {activeTab === 'payment' && (
            <PaymentView
              initialSession={paymentSession}
              onPaymentRegistered={(payId) => {
                setUploadPaymentId(payId);
                setActiveTab('receipts-upload');
              }}
            />
          )}

          {activeTab === 'exit' && (
            <ExitView
              initialSessionId={selectedExitSessionId}
              onProceedToPayment={(sess) => {
                setPaymentSession(sess);
                setActiveTab('payment');
              }}
            />
          )}

          {activeTab === 'active-vehicles' && (
            <ActiveVehiclesView
              onSelectForExit={(sess) => {
                setSelectedExitSessionId(sess.id);
                setActiveTab('exit');
              }}
            />
          )}

          {activeTab === 'entry' && (
            <EntryView />
          )}

          {activeTab === 'customers' && (
            <CustomersView />
          )}

          {activeTab === 'services' && (
            <AdditionalServicesSettings />
          )}

          {activeTab === 'tariffs' && (
            <TariffSettings />
          )}

          {activeTab === 'parking-settings' && (
            <ParkingLotSettings />
          )}

          {activeTab === 'dashboard' && (
            <DashboardMVP onNavigate={(tab) => setActiveTab(tab)} />
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
