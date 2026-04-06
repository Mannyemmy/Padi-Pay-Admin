// lib/auth.ts
import { auth, functions, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { recordAdminLogin, upsertAdminProfile } from './firestore';
import { Admin, AdminRole } from './types';
import { defaultRolePermissions } from './routes';

// Auth functions
export async function signInAdmin(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;
  await recordAdminLogin(uid);
  return credential.user;
}

export async function signOutAdmin() {
  await signOut(auth);
}

export async function triggerPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function sendAdminLoginEmailNotification(input: {
  ipAddress?: string;
  userAgent?: string;
}) {
  const callable = httpsCallable(functions, 'sendAdminLoginEmail');
  await callable(input);
}

export async function createAdminAccount(input: { email: string; name: string; role: AdminRole }) {
  const callable = httpsCallable(functions, 'createAdminAccount');
  const result = await callable(input);
  const uid = (result.data as { uid?: string }).uid;
  if (uid) {
    await upsertAdminProfile(uid, { 
      email: input.email, 
      name: input.name, 
      role: input.role, 
      status: 'active',
      permissions: defaultRolePermissions[input.role],
      createdAt: Date.now()
    });
  }
  return uid;
}

export async function deleteAdminAccount(uid: string) {
  const callable = httpsCallable(functions, 'deleteAdminAccount');
  await callable({ uid });
}

export async function updateAdminAccount(uid: string, data: { email?: string; name?: string }) {
  const callable = httpsCallable(functions, 'updateAdminAccount');
  await callable({ uid, ...data });
}

// Get current authenticated user
export function getCurrentUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Get current admin with permissions
export async function getCurrentAdmin(): Promise<Admin | null> {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return null;
    }

    // Get admin profile from Firestore
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    
    if (!adminDoc.exists()) {
      return null;
    }

    const adminData = adminDoc.data();
    const role = (adminData.role || 'customer_service') as AdminRole;

   return {
  id: user.uid,
  email: user.email || adminData.email || '',
  name: adminData.name || '',
  role,
  status: adminData.status || 'active',
  lastLoginAt: adminData.lastLoginAt,
  createdAt: adminData.createdAt || Date.now(),
  permissions:
    adminData.permissions || defaultRolePermissions[role],
} as Admin;

  } catch (error) {
    console.error('Error getting current admin:', error);
    return null;
  }
}

// Check if admin has permission to access a route
export function hasPermission(admin: Admin | null, route: string): boolean {
  if (!admin) return false;
  
  // Super admin always has access
  if (admin.role === 'admin') return true;
  
  // Check specific permissions
  return admin.permissions?.[route as keyof typeof admin.permissions] || false;
}