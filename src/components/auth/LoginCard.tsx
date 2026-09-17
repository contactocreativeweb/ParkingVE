import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogIn, KeyRound, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const LoginCard: React.FC = () => {
  const { signIn, signUp, resetPassword, error: authError } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) setLocalError(error.message);
      } else if (mode === 'register') {
        if (!firstName.trim()) {
          setLocalError('Por favor ingresa tu nombre');
          setSubmitting(false);
          return;
        }
        const { error } = await signUp(email, password, firstName, lastName);
        if (error) {
          setLocalError(error.message);
        } else {
          setSuccessMessage('¡Cuenta creada con éxito! Revisa tu correo si requiere confirmación o inicia sesión.');
          setMode('login');
        }
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          setLocalError(error.message);
        } else {
          setSuccessMessage('Se ha enviado el enlace de recuperación a tu correo electrónico.');
        }
      }
    } catch (err: any) {
      setLocalError(err.message || 'Ocurrió un error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  const activeError = localError || authError;

  return (
    <div style={{
      maxWidth: '440px',
      width: '100%',
      margin: '2rem auto',
      padding: '2.5rem 2rem',
      backgroundColor: 'var(--bg-card)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-lg)',
      position: 'relative',
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #2b82b5 0%, #52a5d2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
          boxShadow: '0 8px 20px rgba(43, 130, 181, 0.28)',
        }}>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff' }}>P</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.25rem' }}>ParkingVE</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {mode === 'login' && 'Sistema de Gestión y Control de Estacionamiento'}
          {mode === 'register' && 'Crear nueva cuenta administrativa'}
          {mode === 'forgot' && 'Recuperar acceso a tu cuenta'}
        </p>
      </div>

      {/* Status Alerts */}
      {activeError && (
        <div className="alert alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{activeError}</span>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="Juan"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido</label>
              <input
                type="text"
                className="input-field"
                placeholder="Pérez"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Correo electrónico</label>
          <div style={{ position: 'relative' }}>
            <input
              type="email"
              required
              className="input-field"
              placeholder="operador@parkingve.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Contraseña</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setLocalError(null); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            <input
              type="password"
              required
              minLength={6}
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '0.5rem' }}
        >
          {submitting ? (
            'Procesando...'
          ) : mode === 'login' ? (
            <>
              <LogIn size={18} /> Iniciar Sesión
            </>
          ) : mode === 'register' ? (
            'Crear Cuenta'
          ) : (
            <>
              <KeyRound size={18} /> Enviar enlace de recuperación
            </>
          )}
        </button>
      </form>

      {/* Mode Switcher */}
      <div style={{
        marginTop: '1.5rem',
        paddingTop: '1.25rem',
        borderTop: '1px solid var(--border-subtle)',
        textAlign: 'center',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
      }}>
        {mode === 'login' ? (
          <div>
            ¿Nuevo en ParkingVE?{' '}
            <button
              type="button"
              onClick={() => { setMode('register'); setLocalError(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Registrar empresa
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setMode('login'); setLocalError(null); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <ArrowLeft size={16} /> Volver a Iniciar Sesión
          </button>
        )}
      </div>
    </div>
  );
};
