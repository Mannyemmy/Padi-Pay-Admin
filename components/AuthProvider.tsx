'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getAdmin } from '@/lib/firestore';
import { Admin } from '@/lib/types';

interface AuthContextValue {
  user: FirebaseUser | null;
  admin: Admin | null;
  loading: boolean;
  refreshAdmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAdmin = async () => {
    if (!user) return;
    const adminDoc = await getAdmin(user.uid);
    setAdmin(adminDoc);
  };

  useEffect(() => {
    let isMounted = true;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;
      setLoading(true);
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const adminDoc = await getAdmin(firebaseUser.uid);
          if (isMounted) setAdmin(adminDoc);
        } catch (error) {
          console.error('Failed to load admin:', error);
          if (isMounted) setAdmin(null);
        }
      } else {
        setAdmin(null);
      }
      if (isMounted) setLoading(false);
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, admin, loading, refreshAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
