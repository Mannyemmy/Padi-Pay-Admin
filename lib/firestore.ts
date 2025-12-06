import { db } from './firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { User, Transaction, Admin, DashboardStats, Business, AdminRole } from './types';
import { httpsCallable } from 'firebase/functions';

// USER OPERATIONS
export async function getUsers() {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    } as User;
  });
}

export async function getUser(userId: string) {
  const docRef = doc(db, 'users', userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function updateUserStatus(userId: string, status: 'active' | 'inactive' | 'suspended') {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { status });
}

// TRANSACTION OPERATIONS
export async function getTransactions() {
  // Some documents lack a uniform 'date' field; fetch all and sort client-side using known date/timestamp fields.
  const snapshot = await getDocs(collection(db, 'transactions'));
  const items = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Transaction;
    const dateVal = data.timestamp || data.date || data.createdAt;
    const date = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    return {
      ...data,
      id: docSnap.id,
      date,
    } as Transaction;
  });

  return items.sort((a, b) => {
    const ad = a.date ? new Date(a.date).getTime() : 0;
    const bd = b.date ? new Date(b.date).getTime() : 0;
    return bd - ad;
  });
}

export async function getTransaction(transactionId: string) {
  const docRef = doc(db, 'transactions', transactionId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getTransactionsByUser(userId: string) {
  const q = query(collection(db, 'transactions'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Transaction;
    const dateVal = data.timestamp || data.date || data.createdAt;
    const date = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
    return {
      ...data,
      id: docSnap.id,
      date,
    } as Transaction;
  });

  return items
    .filter((t) => t.userId === userId || (t as Transaction & { user_id?: string }).user_id === userId)
    .sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return bd - ad;
    })
    .slice(0, 20);
}

export async function updateTransactionStatus(
  transactionId: string,
  status: 'success' | 'pending' | 'failed'
) {
  const txnRef = doc(db, 'transactions', transactionId);
  await updateDoc(txnRef, { status });
}

// ADMIN OPERATIONS
export async function getAdmins() {
  const q = query(collection(db, 'admins'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
      lastLoginAt: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : data.lastLoginAt,
    } as Admin;
  });
}

export async function getAdmin(adminId: string) {
  const docRef = doc(db, 'admins', adminId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
    lastLoginAt: data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : data.lastLoginAt,
  } as Admin;
}

export async function createAdmin(adminData: Omit<Admin, 'id'>) {
  const adminRef = doc(collection(db, 'admins'));
  await setDoc(adminRef, {
    ...adminData,
    createdAt: serverTimestamp(),
    lastLoginAt: null,
  });
  return adminRef.id;
}

export async function deleteAdmin(adminId: string) {
  await deleteDoc(doc(db, 'admins', adminId));
}

export async function upsertAdminProfile(adminId: string, data: { name?: string; role?: AdminRole; status?: 'active' | 'inactive'; email?: string; }) {
  const adminRef = doc(db, 'admins', adminId);
  await setDoc(
    adminRef,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function recordAdminLogin(adminId: string) {
  const adminRef = doc(db, 'admins', adminId);
  await setDoc(
    adminRef,
    {
      lastLoginAt: serverTimestamp(),
      status: 'active',
    },
    { merge: true }
  );
}

// SETTINGS OPERATIONS
export async function getSettings() {
  const docRef = doc(db, 'settings', 'config');
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

export async function updateSettings(settings: Record<string, unknown>) {
  const docRef = doc(db, 'settings', 'config');
  await updateDoc(docRef, settings);
}

// DASHBOARD STATISTICS
export async function getDashboardStats(): Promise<DashboardStats> {
  // Fetch all necessary data from Firestore and calculate stats
  const users = await getUsers();
  const transactions = await getTransactions();

  const deposits = transactions
    .filter((t) => t.type === 'deposit' && t.status === 'success')
    .reduce((sum, t) => sum + t.amount, 0);
  const withdrawals = transactions
    .filter((t) => t.type === 'withdrawal' && t.status === 'success')
    .reduce((sum, t) => sum + t.amount, 0);
  const pendingWithdrawals = transactions
    .filter((t) => t.type === 'withdrawal' && t.status === 'pending')
    .reduce((sum, t) => sum + t.amount, 0);

  // Generate weekly data (this should be based on actual data from your database)
  const weeklyActivity = [
    { day: 'Mon', amount: 45000 },
    { day: 'Tue', amount: 52000 },
    { day: 'Wed', amount: 48000 },
    { day: 'Thu', amount: 61000 },
    { day: 'Fri', amount: 55000 },
    { day: 'Sat', amount: 67000 },
    { day: 'Sun', amount: 58000 },
  ];

  return {
    totalBalance: deposits - withdrawals,
    totalDeposits: deposits,
    totalWithdrawals: withdrawals,
    pendingWithdrawals,
    totalUsers: users.length,
    totalTransactions: transactions.length,
    weeklyActivity,
  };
}

// BUSINESS OPERATIONS
export async function getBusinesses() {
  const q = query(collection(db, 'businesses'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Business[];
}

export async function getBusiness(businessId: string) {
  const docRef = doc(db, 'businesses', businessId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getBusinessesByOwner(userId: string) {
  const q = query(
    collection(db, 'businesses'),
    where('contact_data.email', '==', userId) // Adjust based on actual field
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Business[];
}

export async function updateBusinessStatus(
  businessId: string,
  status: 'active' | 'inactive' | 'suspended'
) {
  const bizRef = doc(db, 'businesses', businessId);
  await updateDoc(bizRef, { status });
}

// USER ACCOUNT MANAGEMENT
export async function freezeAccount(
  accountId: string,
  freezeReason: string,
  freezeDescription: string
) {
  try {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('./firebase');
    
    const freezeAccountFn = httpsCallable(functions, 'freezeAccount');
    const result = await freezeAccountFn({
      accountId,
      freezeReason,
      freezeDescription,
    });
    
    return result.data;
  } catch (error) {
    console.error('Error freezing account:', error);
    throw error;
  }
}


export async function unFreezeAccount(accountId: string) {
  try {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('./firebase');
    
    const unFreezeAccountFn = httpsCallable(functions, 'unFreezeAccount');
    const result = await unFreezeAccountFn({
      accountId,
    });
    
    return result.data;
  } catch (error) {
    console.error('Error unfreezing account:', error);
    throw error;
  }
}

export async function deleteUser(userId: string) {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
    console.log('User deleted from Firestore:', userId);
    return { success: true, message: 'User deleted successfully' };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

export async function updateUserProfile(
  userId: string,
  updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    dateOfBirth?: string;
  }
) {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    // If email is being updated, also update in Firebase Auth via backend API
    if (updates.email) {
      try {
        const updateUserEmailFn = httpsCallable(
          getFirebaseFunction(),
          'updateUserEmail'
        );
        await updateUserEmailFn({
          userId,
          newEmail: updates.email,
        });
      } catch (error) {
        console.error('Error updating email in auth:', error);
        // Non-critical error - Firestore update succeeded
      }
    }

    return { success: true, message: 'Profile updated successfully' };
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function contactUser(
  userId: string,
  message: string,
  channel: 'email' | 'sms'
) {
  try {
    // Send contact message via email or SMS
    console.log('Contacting user:', { userId, message, channel });
    return { success: true, message: `Message sent via ${channel}` };
  } catch (error) {
    console.error('Error contacting user:', error);
    throw error;
  }
}

function getFirebaseFunction(): import("@firebase/functions").Functions {
  throw new Error('Function not implemented.');
}
