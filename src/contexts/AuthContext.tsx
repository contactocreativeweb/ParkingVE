import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, Organization, OrganizationRole, ParkingLot } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  role: OrganizationRole | null;
  parkingLots: ParkingLot[];
  currentParkingLot: ParkingLot | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  setCurrentParkingLot: (parkingLot: ParkingLot) => void;
  refreshTenantContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<OrganizationRole | null>(null);
  const [parkingLots, setParkingLots] = useState<ParkingLot[]>([]);
  const [currentParkingLot, setCurrentParkingLot] = useState<ParkingLot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTenantData = async (currentUser: User) => {
    try {
      setError(null);
      // 1. Cargar o sincronizar perfil
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profileErr) {
        console.warn('Error fetching profile:', profileErr.message);
      }

      if (profileData) {
        setProfile(profileData as Profile);
      } else {
        // Perfil fallback desde auth metadata
        setProfile({
          id: currentUser.id,
          first_name: currentUser.user_metadata?.first_name || currentUser.email?.split('@')[0] || 'Usuario',
          last_name: currentUser.user_metadata?.last_name || '',
          phone: currentUser.user_metadata?.phone || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // 2. Cargar membresía y organización (Usuario -> Organization -> Role)
      const { data: memberData, error: memberErr } = await supabase
        .from('organization_members')
        .select('role, organization_id, organizations(*)')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (memberErr) {
        console.warn('Error fetching organization member:', memberErr.message);
      }

      if (memberData && memberData.organizations) {
        const org = Array.isArray(memberData.organizations) 
          ? memberData.organizations[0] 
          : memberData.organizations;
        const userRole = memberData.role as OrganizationRole;
        setOrganization(org as unknown as Organization);
        setRole(userRole);

        // 3. Cargar Estacionamientos (Parking Lots)
        let lots: ParkingLot[] = [];
        if (userRole === 'OWNER' || userRole === 'ADMIN') {
          // Acceso a todos los estacionamientos activos de la organización
          const { data: allLots } = await supabase
            .from('parking_lots')
            .select('*')
            .eq('organization_id', (org as unknown as Organization).id)
            .eq('is_active', true);
          lots = (allLots || []) as ParkingLot[];
        } else {
          // OPERATOR: Acceso únicamente a los estacionamientos asignados
          const { data: assignedLots } = await supabase
            .from('parking_lot_members')
            .select('parking_lot_id, parking_lots(*)')
            .eq('user_id', currentUser.id);

          if (assignedLots) {
            lots = assignedLots
              .map((item: any) => item.parking_lots)
              .filter(Boolean) as ParkingLot[];
          }
        }

        setParkingLots(lots);
        // Mantener selección previa si sigue siendo válida, sino seleccionar el primer estacionamiento
        setCurrentParkingLot((prev) => {
          if (prev && lots.some((l) => l.id === prev.id)) return prev;
          return lots.length > 0 ? lots[0] : null;
        });
      } else {
        setOrganization(null);
        setRole(null);
        setParkingLots([]);
        setCurrentParkingLot(null);
      }
    } catch (err: any) {
      console.error('Error loading tenant context:', err);
      setError(err.message || 'Error al cargar datos del usuario');
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Obtener sesión inicial
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        await loadTenantData(initialSession.user);
      }
      setLoading(false);
    });

    // Suscribirse a cambios de sesión (Login, Logout, Token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        setLoading(true);
        await loadTenantData(newSession.user);
        setLoading(false);
      } else {
        setProfile(null);
        setOrganization(null);
        setRole(null);
        setParkingLots([]);
        setCurrentParkingLot(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setError(null);
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) {
      setError(signInErr.message);
      return { error: signInErr };
    }
    return { error: null };
  };

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    setError(null);
    const { error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    if (signUpErr) {
      setError(signUpErr.message);
      return { error: signUpErr };
    }
    return { error: null };
  };

  const signOut = async () => {
    setError(null);
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    setError(null);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetErr) {
      setError(resetErr.message);
      return { error: resetErr };
    }
    return { error: null };
  };

  const refreshTenantContext = async () => {
    if (user) {
      await loadTenantData(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        organization,
        role,
        parkingLots,
        currentParkingLot,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        resetPassword,
        setCurrentParkingLot,
        refreshTenantContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
