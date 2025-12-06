import { auth, functions } from './firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { recordAdminLogin, upsertAdminProfile } from './firestore';
import { AdminRole } from './types';

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

export async function createAdminAccount(input: { email: string; name: string; role: AdminRole }) {
  const callable = httpsCallable(functions, 'createAdminAccount');
  const result = await callable(input);
  const uid = (result.data as { uid?: string }).uid;
  if (uid) {
    await upsertAdminProfile(uid, { email: input.email, name: input.name, role: input.role, status: 'active' });
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
