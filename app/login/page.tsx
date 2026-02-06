'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInAdmin, triggerPasswordReset } from '@/lib/auth';
import { activityLogger } from '@/lib/services/activityLogger';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Mail, Lock, LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Function to get client IP address
  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch('/api/ip');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      return 'unknown';
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    
    try {
      // Sign in the admin using your existing function
      const firebaseUser = await signInAdmin(email, password);
      
      if (firebaseUser) {
        // Get client information for logging
        const userAgent = navigator.userAgent || 'unknown';
        const ipAddress = await getClientIP();
        
        // Fetch admin data directly from Firestore admins collection
        try {
          const adminDocRef = doc(db, 'admins', firebaseUser.uid);
          const adminDoc = await getDoc(adminDocRef);
          
          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            
            // Log successful login with admin data
            await activityLogger.logLogin(
              firebaseUser.uid,
              adminData.email || firebaseUser.email || email,
              adminData.name || adminData.email?.split('@')[0] || firebaseUser.email?.split('@')[0] || email.split('@')[0],
              userAgent,
              ipAddress
            );
            
            console.log('Login logged for admin:', adminData.email);
          } else {
            // Admin document not found in admins collection
            console.warn('Admin document not found for UID:', firebaseUser.uid);
            
            // Log with Firebase user data as fallback
            await activityLogger.logLogin(
              firebaseUser.uid,
              firebaseUser.email || email,
              firebaseUser.email?.split('@')[0] || email.split('@')[0],
              userAgent,
              ipAddress
            );
          }
        } catch (fetchError) {
          console.error('Error fetching admin data from Firestore:', fetchError);
          
          // Log with minimal data if fetch fails
          await activityLogger.logLogin(
            firebaseUser.uid,
            firebaseUser.email || email,
            firebaseUser.email?.split('@')[0] || email.split('@')[0],
            userAgent,
            ipAddress
          );
        }
        
        // Redirect to dashboard
        router.refresh();
        router.replace('/');
      } else {
        throw new Error('Login failed - no user returned');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
      
      // Log failed login attempts
      try {
        const userAgent = navigator.userAgent || 'unknown';
        const ipAddress = await getClientIP();
        
        await activityLogger.logApiCall(
          'anonymous',
          email,
          'Anonymous User',
          '/login',
          'POST',
          401,
          {
            error: message,
            attemptEmail: email
          },
          userAgent,
          ipAddress
        );
      } catch (logError) {
        console.error('Failed to log failed login attempt:', logError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setInfo(null);
    
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    
    try {
      await triggerPasswordReset(email);
      setInfo('Password reset email sent');
      
      // Log password reset request
      const userAgent = navigator.userAgent || 'unknown';
      const ipAddress = await getClientIP();
      
      await activityLogger.logApiCall(
        'anonymous',
        email,
        'Password Reset User',
        '/login',
        'POST',
        200,
        {
          action: 'password_reset_request',
          email: email
        },
        userAgent,
        ipAddress
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to send reset email';
      setError(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8 space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-gray-900">PadiPay Admin</h1>
          <p className="text-sm text-gray-500">Sign in to manage the platform</p>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
        {info && <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">{info}</div>}

        <form className="space-y-4" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="text-right">
          <button 
            onClick={handleReset} 
            className="text-sm text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!email || loading}
          >
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}