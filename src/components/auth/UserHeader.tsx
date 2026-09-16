import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, Building2, MapPin, ChevronDown } from 'lucide-react';
import type { ParkingLot } from '../../types/database';

export const UserHeader: React.FC = () => {
  const {
    user,
    profile,
    organization,
    role,
    parkingLots,
    currentParkingLot,
    setCurrentParkingLot,
    signOut,
  } = useAuth();

  if (!user) return null;

  const roleBadgeClass = {
    OWNER: 'badge-owner',
    ADMIN: 'badge-admin',
    OPERATOR: 'badge-operator',
  }[role || 'OPERATOR'];

  return (
    <header style={{
      backgroundColor: 'var(--bg-card)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '0.75rem 1.25rem',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        {/* Left: App Brand & Organization */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 800,
              fontSize: '1rem',
            }}>
              P
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              Parking<span style={{ color: 'var(--accent-secondary)' }}>VE</span>
            </span>
          </div>

          {organization && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
            }}>
              <Building2 size={15} color="var(--accent-primary)" />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{organization.name}</span>
            </div>
          )}
        </div>

        {/* Center: Parking Lot Selector (sección 51: Parking Lot Switcher) */}
        {parkingLots.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <MapPin size={16} color="var(--accent-secondary)" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
              <select
                aria-label="Seleccionar estacionamiento"
                value={currentParkingLot?.id || ''}
                onChange={(e) => {
                  const selected = parkingLots.find((l) => l.id === e.target.value);
                  if (selected) setCurrentParkingLot(selected);
                }}
                className="input-field"
                style={{
                  paddingLeft: '2rem',
                  paddingRight: '2rem',
                  paddingTop: '0.45rem',
                  paddingBottom: '0.45rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  appearance: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-input)',
                }}
              >
                {parkingLots.map((lot: ParkingLot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
          </div>
        )}

        {/* Right: User profile, Role Badge & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : user.email}
              </span>
              {role && <span className={`badge ${roleBadgeClass}`}>{role}</span>}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email}</span>
          </div>

          <button
            type="button"
            onClick={signOut}
            title="Cerrar sesión"
            className="btn btn-ghost"
            style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
