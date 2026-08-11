import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChange, getCurrentStaff } from '../lib/auth';
import type { StaffMember } from '../types';

interface AuthContextType {
  staff: StaffMember | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  staff: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const staffMember = await getCurrentStaff();
      if (cancelled) return;
      setStaff(staffMember);
      setLoading(false);
      initialized.current = true;
    })();

    const authSubscription = onAuthStateChange((staffMember) => {
      if (!staffMember) {
        setStaff(null);
        setLoading(false);
        return;
      }
      if (!initialized.current && staffMember) {
        setStaff(staffMember);
        setLoading(false);
        initialized.current = true;
      } else if (staffMember) {
        setStaff(staffMember);
      }
    });

    return () => {
      cancelled = true;
      if (authSubscription && typeof authSubscription === 'object' && 'subscription' in authSubscription) {
        const subscription = authSubscription.subscription as { unsubscribe?: () => void } | undefined;
        subscription?.unsubscribe?.();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ staff, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
