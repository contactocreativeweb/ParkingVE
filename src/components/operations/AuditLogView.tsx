import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Shield,
  Search,
  RefreshCw,
  AlertCircle,
  Clock,
  User,
  FileText,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { AuditLog } from '../../types/database';

interface AuditLogWithProfile extends AuditLog {
  profiles?: { full_name: string | null; email: string } | null;
}

type ActionFilter = 'ALL' | 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'REJECT';

export const AuditLogView: React.FC = () => {
  const { currentParkingLot, role } = useAuth();
  const [logs, setLogs] = useState<AuditLogWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);

  const loadLogs = async () => {
    if (!currentParkingLot) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, profiles(full_name, email)')
        .eq('parking_lot_id', currentParkingLot.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (actionFilter !== 'ALL') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data || []) as AuditLogWithProfile[]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar auditoría.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParkingLot?.id, actionFilter, limit]);

  const isOwnerOrAdmin = role === 'OWNER' || role === 'ADMIN';

  if (!currentParkingLot) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}><h3>Selecciona un estacionamiento</h3></div>;
  }

  if (!isOwnerOrAdmin) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <Shield size={44} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3 style={{ fontSize: '1.15rem' }}>Acceso Restringido</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Solo los roles OWNER y ADMIN pueden acceder al registro de auditoría.
        </p>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const entityType = (log.entity_type || '').toLowerCase();
    const action = (log.action || '').toLowerCase();
    const userName = log.profiles?.full_name?.toLowerCase() || '';
    const email = log.profiles?.email?.toLowerCase() || '';
    const metaStr = log.metadata ? JSON.stringify(log.metadata).toLowerCase() : '';
    return entityType.includes(term) || action.includes(term) || userName.includes(term) || email.includes(term) || metaStr.includes(term);
  });

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'INSERT': return '#10b981';
      case 'UPDATE': return 'var(--accent-primary)';
      case 'DELETE': return 'var(--status-error)';
      case 'APPROVE': return '#10b981';
      case 'REJECT': return '#ef4444';
      case 'LOGIN': return 'var(--accent-secondary)';
      case 'LOGOUT': return 'var(--text-muted)';
      default: return 'var(--text-secondary)';
    }
  };

  const getActionLabel = (action: string): string => {
    switch (action) {
      case 'INSERT': return 'CREAR';
      case 'UPDATE': return 'MODIFICAR';
      case 'DELETE': return 'ELIMINAR';
      case 'APPROVE': return 'APROBAR';
      case 'REJECT': return 'RECHAZAR';
      case 'LOGIN': return 'INICIO SESIÓN';
      case 'LOGOUT': return 'CIERRE SESIÓN';
      default: return action;
    }
  };

  const actionOptions: ActionFilter[] = ['ALL', 'INSERT', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT'];

  const getDescription = (log: AuditLogWithProfile): string => {
    if (log.metadata && typeof log.metadata === 'object') {
      const desc = (log.metadata as Record<string, unknown>).description;
      if (typeof desc === 'string') return desc;
    }
    return '';
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-operator">FASE 17: AUDITORÍA</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Sede: <strong style={{ color: 'var(--text-primary)' }}>{currentParkingLot.name}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.75rem', margin: 0 }}>Registro de Auditoría</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Historial completo de acciones críticas realizadas en el sistema.
          </p>
        </div>
        <button type="button" onClick={loadLogs} disabled={loading} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          flex: 1, minWidth: '240px',
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1rem',
        }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text" className="input-field"
            style={{ border: 'none', padding: '0.2rem 0', backgroundColor: 'transparent', boxShadow: 'none' }}
            placeholder="Buscar por entidad, usuario, acción…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Filter size={15} color="var(--text-muted)" />
          {actionOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setActionFilter(opt)}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: actionFilter === opt ? 700 : 600,
                cursor: 'pointer',
                border: actionFilter === opt ? `1px solid ${getActionColor(opt)}` : '1px solid var(--border-subtle)',
                backgroundColor: actionFilter === opt ? `${getActionColor(opt)}18` : 'var(--bg-card)',
                color: actionFilter === opt ? getActionColor(opt) : 'var(--text-muted)',
                transition: 'all 0.12s ease',
              }}
            >
              {opt === 'ALL' ? 'Todos' : getActionLabel(opt)}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} /><span>{errorMsg}</span>
        </div>
      )}

      {/* Tabla de Logs */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando registros de auditoría…</div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
            <FileText size={44} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.1rem' }}>Sin registros de auditoría</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Las acciones críticas se registran automáticamente.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredLogs.map((log, idx) => {
              const isExpanded = expandedId === log.id;
              const desc = getDescription(log);
              return (
                <div key={log.id} style={{
                  borderBottom: idx < filteredLogs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.85rem 1.5rem', cursor: 'pointer',
                      transition: 'background-color 0.12s ease',
                      flexWrap: 'wrap', gap: '0.75rem',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-input)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: '280px' }}>
                      <span style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        backgroundColor: `${getActionColor(log.action)}18`,
                        color: getActionColor(log.action),
                        minWidth: '70px',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        {getActionLabel(log.action)}
                      </span>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {log.entity_type || '—'}
                          {desc && (
                            <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                              {desc.length > 60 ? desc.slice(0, 60) + '…' : desc}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          <User size={12} />
                          <span>{log.profiles?.full_name || log.profiles?.email || log.user_id?.slice(0, 8) || 'Sistema'}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <Clock size={13} />
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                      {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{
                      padding: '0.75rem 1.5rem 1.25rem',
                      backgroundColor: 'var(--bg-input)',
                      borderTop: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                            Entity ID
                          </div>
                          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {log.entity_id || '—'}
                          </code>
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                            Tipo de Entidad
                          </div>
                          <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {log.entity_type || '—'}
                          </code>
                        </div>
                      </div>

                      {log.ip_address && (
                        <div style={{ marginTop: '0.85rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                            IP / User Agent
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {log.ip_address}{log.user_agent ? ` — ${log.user_agent}` : ''}
                          </div>
                        </div>
                      )}

                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div style={{ marginTop: '0.85rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                            Metadata
                          </div>
                          <pre style={{
                            fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                            backgroundColor: 'var(--bg-card)', padding: '0.75rem',
                            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
                            overflowX: 'auto', color: 'var(--text-secondary)', margin: 0,
                          }}>
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && filteredLogs.length >= limit && (
          <div style={{ padding: '1rem', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={() => setLimit(limit + 30)} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
              Cargar más registros…
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
