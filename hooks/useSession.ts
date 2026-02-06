'use client';

import { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useSession() {
  const [admin, setAdmin] = useState<any>(null);
  const [userAgent, setUserAgent] = useState<string>('');
  const [ipAddress, setIpAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user agent
    if (typeof window !== 'undefined') {
      setUserAgent(navigator.userAgent);
      
      // Get IP address (client-side approximation)
      fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => setIpAddress(data.ip))
        .catch(() => setIpAddress('unknown'));
    }
  }, []);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch admin data from Firestore
          const adminDocRef = doc(db, 'admins', user.uid);
          const adminDoc = await getDoc(adminDocRef);
          
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            setAdmin({
              id: user.uid,
              email: user.email,
              name: adminData.name,
              ...adminData
            });
          }
        } catch (error) {
          console.error('Error fetching admin data:', error);
          setAdmin(null);
        }
      } else {
        setAdmin(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { admin, userAgent, ipAddress, loading };
}