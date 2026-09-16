import { supabase } from './supabase';

export interface LogAuditParams {
  organizationId: string;
  parkingLotId?: string;
  userId?: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'APPROVE' | 'REJECT';
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra una acción crítica en public.audit_logs según Sección 65 del Documento Maestro.
 * Es no bloqueante para no interrumpir el flujo operacional si falla el logging.
 */
export async function logAuditEvent({
  organizationId,
  parkingLotId,
  userId,
  action,
  entityType,
  entityId,
  metadata,
}: LogAuditParams): Promise<void> {
  try {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
    await supabase.from('audit_logs').insert([
      {
        organization_id: organizationId,
        parking_lot_id: parkingLotId,
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata: metadata || {},
        user_agent: userAgent,
      },
    ]);
  } catch (err) {
    console.warn('Advertencia al registrar evento de auditoría:', err);
  }
}
