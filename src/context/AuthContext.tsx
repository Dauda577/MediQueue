import { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    // Check for existing session on mount
    getCurrentStaff().then((staffMember) => {
      setStaff(staffMember);
      setLoading(false);
    });

    // Listen for auth state changes (handles invite links too)
    const { data: { subscription } } = onAuthStateChange((staffMember) => {
      setStaff(staffMember);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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