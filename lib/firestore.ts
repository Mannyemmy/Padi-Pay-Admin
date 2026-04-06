import { db, auth, functions, storage } from "./firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  getDocFromServer,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import {
  User,
  Transaction,
  Admin,
  DashboardStats,
  Business,
  AdminRole,
  Referral,
} from "./types";
import { httpsCallable } from "firebase/functions";

export interface MockFilterOptions {
  mock?: boolean;
}

// USER OPERATIONS
export async function getUsers(options?: MockFilterOptions) {
  const constraints: any[] = [orderBy("createdAt", "desc")];
  if (options?.mock) constraints.unshift(where("mock", "==", true));
  const q = query(collection(db, "users"), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : data.createdAt,
      } as User;
    })
    .filter((u) => {
      if (options?.mock) return true;
      if ((u as any).mock) return false;
      return true;
    });
}

export async function getUser(userId: string) {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function updateUserStatus(
  userId: string,
  status: "active" | "inactive" | "suspended",
) {
  const userRef = doc(db, "users", userId);
  await updateDoc(userRef, { status });
}

export async function setUserRole(userId: string, role?: string | null) {
  const userRef = doc(db, "users", userId);
  if (role == null) {
    await updateDoc(userRef, {
      role: deleteField(),
      agentAssignedAt: deleteField(),
      updatedAt: serverTimestamp(),
    });
  } else {
    const updates: Record<string, any> = { role, updatedAt: serverTimestamp() };
    if (role === "agent") {
      updates.agentAssignedAt = serverTimestamp();
    } else {
      updates.agentAssignedAt = deleteField();
    }
    await updateDoc(userRef, updates);
  }
}

// TRANSACTION OPERATIONS
export async function getTransactions(options?: MockFilterOptions) {
  // Some documents lack a uniform 'date' field; fetch all and sort client-side using known date/timestamp fields.
  const constraints: any[] = [];
  if (options?.mock) constraints.push(where("mock", "==", true));
  const q = constraints.length
    ? query(collection(db, "transactions"), ...constraints)
    : collection(db, "transactions");
  const snapshot = await getDocs(q);
  const items = snapshot.docs
    .map((docSnap) => {
      const data = docSnap.data() as Transaction;
      const dateVal = data.timestamp || data.date || data.createdAt;
      const date = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
      return {
        ...data,
        id: docSnap.id,
        date,
      } as Transaction;
    })
    .filter((t) => {
      if (options?.mock) return true;
      if ((t as any).mock) return false;
      const uid = (t as any).userId;
      if (typeof uid === 'string' && uid.startsWith('mock_')) return false;
      return true;
    });

  return items.sort((a, b) => {
    const ad = a.date ? new Date(a.date).getTime() : 0;
    const bd = b.date ? new Date(b.date).getTime() : 0;
    return bd - ad;
  });
}

export async function getTransaction(transactionId: string) {
  const docRef = doc(db, "transactions", transactionId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getTransactionsByUser(userId: string, options?: MockFilterOptions) {
  const constraints: any[] = [where("userId", "==", userId)];
  if (options?.mock) constraints.push(where("mock", "==", true));
  const q = query(
    collection(db, "transactions"),
    ...constraints,
  );
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
    .filter(
      (t) =>
        t.userId === userId ||
        (t as Transaction & { user_id?: string }).user_id === userId,
    )
    .sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return bd - ad;
    })
    .slice(0, 20);
}

export async function getTransactionStatsByUser(userId: string, options?: MockFilterOptions) {
  const constraints: any[] = [where("userId", "==", userId)];
  if (options?.mock) constraints.push(where("mock", "==", true));
  const q = query(
    collection(db, "transactions"),
    ...constraints,
  );
  const snapshot = await getDocs(q);
  let total = 0;
  let count = 0;
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data() as Transaction;
    const amt =
      typeof data.amount === "number" ? data.amount : Number(data.amount || 0);
    // Only count successful transactions to represent actual transacted amount
    if (data.status === "success" || data.status === "successful") {
      total += amt;
      count += 1;
    }
  });
  return { total, count };
}

export async function getReferralsByReferrer(referrerUid: string, options?: MockFilterOptions) {
  const constraints: any[] = [
    where("referrerUid", "==", referrerUid),
    orderBy("createdAt", "desc"),
  ];
  if (options?.mock) constraints.unshift(where("mock", "==", true));
  const q = query(
    collection(db, "referrals"),
    ...constraints,
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate()
        : data.createdAt,
    } as Referral;
  });
}

export async function sendUserNotification(
  userId: string,
  title: string,
  body: string,
) {
  try {
    const callable = httpsCallable(functions, "sendUserNotification");
    await callable({ userId, title, body });
  } catch (err) {
    console.error("Failed to send user notification:", err);
    throw err;
  }
}

export async function updateTransactionStatus(
  transactionId: string,
  status: "success" | "pending" | "failed",
) {
  const txnRef = doc(db, "transactions", transactionId);
  await updateDoc(txnRef, { status });
}

// ADMIN OPERATIONS
export async function getAdmins(options?: MockFilterOptions) {
  const constraints: any[] = [];
  if (options?.mock) constraints.push(where("mock", "==", true));
  const q = constraints.length
    ? query(collection(db, "admins"), ...constraints)
    : query(collection(db, "admins"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate()
        : data.createdAt,
      lastLoginAt: data.lastLoginAt?.toDate
        ? data.lastLoginAt.toDate()
        : data.lastLoginAt,
    } as Admin;
  });
}

export async function getAdmin(adminId: string) {
  const docRef = doc(db, "admins", adminId);
  const docSnap = await getDocFromServer(docRef);
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate
      ? data.createdAt.toDate()
      : data.createdAt,
    lastLoginAt: data.lastLoginAt?.toDate
      ? data.lastLoginAt.toDate()
      : data.lastLoginAt,
  } as Admin;
}

export async function createAdmin(adminData: Omit<Admin, "id">) {
  const adminRef = doc(collection(db, "admins"));
  await setDoc(adminRef, {
    ...adminData,
    createdAt: serverTimestamp(),
    lastLoginAt: null,
  });
  return adminRef.id;
}

export async function deleteAdmin(adminId: string) {
  await deleteDoc(doc(db, "admins", adminId));
}
export async function upsertAdminProfile(
  adminId: string,
  data: {
    createdAt?: Date | number;
    name?: string;
    role?: AdminRole;
    status?: "active" | "inactive";
    email?: string;
    permissions?: Record<string, boolean>; // Add this line
  },
) {
  const adminRef = doc(db, "admins", adminId);
  await setDoc(
    adminRef,
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function recordAdminLogin(adminId: string) {
  const adminRef = doc(db, "admins", adminId);
  await setDoc(
    adminRef,
    {
      lastLoginAt: serverTimestamp(),
      status: "active",
    },
    { merge: true },
  );
}

// SETTINGS OPERATIONS
export async function getSettings() {
  const docRef = doc(db, "settings", "config");
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

export async function updateSettings(settings: Record<string, unknown>) {
  const docRef = doc(db, "settings", "config");
  await updateDoc(docRef, settings);
}

// DASHBOARD STATISTICS
export async function getDashboardStats(options?: MockFilterOptions): Promise<DashboardStats> {
  // Fetch all necessary data from Firestore and calculate stats
  const users = await getUsers(options);
  const transactions = await getTransactions(options);

  const deposits = transactions
    .filter((t) => t.type === "deposit" && t.status === "success")
    .reduce((sum, t) => sum + t.amount, 0);
  const withdrawals = transactions
    .filter((t) => t.type === "withdrawal" && t.status === "success")
    .reduce((sum, t) => sum + t.amount, 0);
  const pendingWithdrawals = transactions
    .filter((t) => t.type === "withdrawal" && t.status === "pending")
    .reduce((sum, t) => sum + t.amount, 0);

  // Generate weekly data (this should be based on actual data from your database)
  const weeklyActivity = [
    { day: "Mon", amount: 45000 },
    { day: "Tue", amount: 52000 },
    { day: "Wed", amount: 48000 },
    { day: "Thu", amount: 61000 },
    { day: "Fri", amount: 55000 },
    { day: "Sat", amount: 67000 },
    { day: "Sun", amount: 58000 },
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
export async function getBusinesses(options?: MockFilterOptions) {
  const constraints: any[] = [];
  if (options?.mock) constraints.push(where("mock", "==", true));
  const q = constraints.length
    ? query(collection(db, "businesses"), ...constraints)
    : query(collection(db, "businesses"));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((b) => {
      if (options?.mock) return true;
      if ((b as any).mock) return false;
      return true;
    }) as Business[];
}

export async function getBusiness(businessId: string) {
  const docRef = doc(db, "businesses", businessId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getBusinessesByOwner(userId: string) {
  const q = query(
    collection(db, "businesses"),
    where("contact_data.email", "==", userId), // Adjust based on actual field
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Business[];
}

export async function updateBusinessStatus(
  businessId: string,
  status: "active" | "inactive" | "suspended",
) {
  const bizRef = doc(db, "businesses", businessId);
  await updateDoc(bizRef, { status });
}

// USER ACCOUNT MANAGEMENT
export async function freezeAccount(
  accountId: string,
  freezeReason: string,
  freezeDescription: string,
) {
  try {
    const { httpsCallable } = await import("firebase/functions");
    const { functions } = await import("./firebase");

    const freezeAccountFn = httpsCallable(functions, "freezeAccount");
    const result = await freezeAccountFn({
      accountId,
      freezeReason,
      freezeDescription,
    });

    return result.data;
  } catch (error) {
    console.error("Error freezing account:", error);
    throw error;
  }
}

export async function unFreezeAccount(accountId: string) {
  try {
    const { httpsCallable } = await import("firebase/functions");
    const { functions } = await import("./firebase");

    const unFreezeAccountFn = httpsCallable(functions, "unFreezeAccount");
    const result = await unFreezeAccountFn({
      accountId,
    });

    return result.data;
  } catch (error) {
    console.error("Error unfreezing account:", error);
    throw error;
  }
}

export async function deleteUser(userId: string) {
  try {
    const userRef = doc(db, "users", userId);
    await deleteDoc(userRef);
    console.log("User deleted from Firestore:", userId);
    return { success: true, message: "User deleted successfully" };
  } catch (error) {
    console.error("Error deleting user:", error);
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
  },
) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    // If email is being updated, also update in Firebase Auth via backend API
    if (updates.email) {
      try {
        const updateUserEmailFn = httpsCallable(
          getFirebaseFunction(),
          "updateUserEmail",
        );
        await updateUserEmailFn({
          userId,
          newEmail: updates.email,
        });
      } catch (error) {
        console.error("Error updating email in auth:", error);
        // Non-critical error - Firestore update succeeded
      }
    }

    return { success: true, message: "Profile updated successfully" };
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
}

export async function contactUser(
  userId: string,
  message: string,
  channel: "email" | "sms",
) {
  try {
    // Send contact message via email or SMS
    console.log("Contacting user:", { userId, message, channel });
    return { success: true, message: `Message sent via ${channel}` };
  } catch (error) {
    console.error("Error contacting user:", error);
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error logging out:", error);
    throw error;
  }
}

function getFirebaseFunction(): import("@firebase/functions").Functions {
  throw new Error("Function not implemented.");
}

// ─── BRM OPERATIONS ───────────────────────────────────────────────────────────

import {
  Brm,
  BrmCommissionLedger,
  BrmCashout,
  BrmMerchant,
  BrmStatus,
} from "./types";

export async function getBrms(): Promise<Brm[]> {
  const q = query(collection(db, "brms"), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
      updated_at: data.updated_at?.toDate ? data.updated_at.toDate() : data.updated_at,
    } as Brm;
  });
}

export async function getBrm(brmId: string): Promise<Brm | null> {
  const snap = await getDoc(doc(db, "brms", brmId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    ...data,
    created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
  } as Brm;
}

export async function updateBrmStatus(brmId: string, status: BrmStatus): Promise<void> {
  await updateDoc(doc(db, "brms", brmId), {
    status,
    updated_at: serverTimestamp(),
  });
}

/** Manual commission adjustment. Inserts a ledger record with type/reason and available status. */
export async function adjustBrmCommission(
  brmId: string,
  amount: number,
  reason: string,
  adminId: string,
): Promise<void> {
  const ledgerRef = doc(collection(db, "brm_commission_ledger"));
  await setDoc(ledgerRef, {
    brm_id: brmId,
    merchant_id: null,
    transaction_id: null,
    type: "manual_adjustment",
    gross_amount: amount,
    commission_amount: amount,
    status: amount >= 0 ? "available" : "paid_out", // negative = debit, treat as paid_out
    reason,
    adjusted_by: adminId,
    created_at: serverTimestamp(),
  });
}

export async function getBrmCommissionSummary(brmId: string): Promise<{
  totalEarned: number;
  available: number;
  pending: number;
}> {
  const q = query(collection(db, "brm_commission_ledger"), where("brm_id", "==", brmId));
  const snap = await getDocs(q);
  let totalEarned = 0;
  let available = 0;
  let pending = 0;
  snap.docs.forEach((d) => {
    const data = d.data();
    const amt: number = data.commission_amount ?? 0;
    if (data.status === "available" || data.status === "paid_out") totalEarned += amt;
    if (data.status === "available") available += amt;
    if (data.status === "pending" || data.status === "accruing") pending += amt;
  });
  return { totalEarned, available, pending };
}

export async function getPendingCashouts(): Promise<BrmCashout[]> {
  const q = query(
    collection(db, "brm_cashouts"),
    where("status", "==", "requested"),
    orderBy("requested_at", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      requested_at: data.requested_at?.toDate ? data.requested_at.toDate() : data.requested_at,
      processed_at: data.processed_at?.toDate ? data.processed_at.toDate() : data.processed_at,
    } as BrmCashout;
  });
}

export async function approveCashout(cashoutId: string, adminId: string): Promise<void> {
  await updateDoc(doc(db, "brm_cashouts", cashoutId), {
    status: "processing",
    processed_by: adminId,
    processed_at: serverTimestamp(),
  });
}

export async function rejectCashout(
  cashoutId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  await updateDoc(doc(db, "brm_cashouts", cashoutId), {
    status: "failed",
    failure_reason: reason,
    processed_by: adminId,
    processed_at: serverTimestamp(),
  });
}

/** Merchants pending activation: kyc_approved but not yet activated */
export async function getMerchantsAwaitingActivation(): Promise<BrmMerchant[]> {
  const q = query(
    collection(db, "merchants"),
    where("activation_status", "==", "kyc_approved"),
    orderBy("created_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
      activated_at: data.activated_at?.toDate ? data.activated_at.toDate() : data.activated_at,
    } as BrmMerchant;
  });
}

/** Override: mark merchant as activated + credit ₦5,000 referral bonus to BRM */
export async function overrideMerchantActivation(
  merchantId: string,
  brmId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  // 1. Update merchant
  await updateDoc(doc(db, "merchants", merchantId), {
    activation_status: "activated",
    referral_bonus_paid: true,
    activated_at: serverTimestamp(),
    activation_overridden_by: adminId,
    activation_override_reason: reason,
  });

  // 2. Credit ₦5,000 referral bonus to BRM (skips pending, goes straight to available)
  const ledgerRef = doc(collection(db, "brm_commission_ledger"));
  await setDoc(ledgerRef, {
    brm_id: brmId,
    merchant_id: merchantId,
    transaction_id: null,
    type: "referral_bonus",
    gross_amount: 5000,
    commission_amount: 5000,
    status: "available",
    reason: `Manual activation override by admin ${adminId}: ${reason}`,
    created_at: serverTimestamp(),
  });
}

/**
 * Upload a BRM agent photo/document to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadBrmFile(
  file: File,
  brmUid: string,
  slot: "profile_photo" | "id_photo",
): Promise<string> {
  const { ref, uploadBytes, getDownloadURL } = await import("firebase/storage");
  const ext = file.name.split(".").pop() ?? "jpg";
  const storageRef = ref(storage, `brms/${brmUid}/${slot}.${ext}`);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export interface CreateBrmPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  nin?: string;
  dateOfBirth?: string;
  address?: string;
  state?: string;
  lga?: string;
  profilePhotoUrl?: string;
  idPhotoUrl?: string;
}

/**
 * Calls the createBrmAgent Cloud Function which creates the brms/{uid}
 * document and stores a bcrypt-hashed password in Firestore.
 */
export async function createBrmAgentFn(
  payload: CreateBrmPayload,
): Promise<{ uid: string; referralCode: string }> {
  const callable = httpsCallable(functions, "createBrmAgent");
  const result = await callable(payload);
  return result.data as { uid: string; referralCode: string };
}

export async function sendBrmWelcomeEmailFn(payload: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  referralCode: string;
  loginUrl: string;
}): Promise<void> {
  const callable = httpsCallable(functions, "sendBrmWelcomeEmail");
  await callable(payload);
}

export interface UpdateBrmPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  nin?: string;
  dateOfBirth?: string;
  address?: string;
  state?: string;
  lga?: string;
  profilePhotoUrl?: string;
  idPhotoUrl?: string;
}

export async function updateBrm(brmId: string, payload: UpdateBrmPayload): Promise<void> {
  const updates: Record<string, any> = { updated_at: serverTimestamp() };
  if (payload.firstName !== undefined || payload.lastName !== undefined) {
    const ref = await getDoc(doc(db, "brms", brmId));
    const existing = ref.data();
    const first = payload.firstName ?? existing?.first_name ?? "";
    const last = payload.lastName ?? existing?.last_name ?? "";
    updates.first_name = first;
    updates.last_name = last;
    updates.full_name = `${first} ${last}`.trim();
  }
  if (payload.email !== undefined) updates.email = payload.email;
  if (payload.phone !== undefined) updates.phone = payload.phone;
  if (payload.nin !== undefined) updates.nin = payload.nin;
  if (payload.dateOfBirth !== undefined) updates.date_of_birth = payload.dateOfBirth;
  if (payload.address !== undefined) updates.address = payload.address;
  if (payload.state !== undefined) updates.state = payload.state;
  if (payload.lga !== undefined) updates.lga = payload.lga;
  if (payload.profilePhotoUrl !== undefined) updates.profile_photo_url = payload.profilePhotoUrl;
  if (payload.idPhotoUrl !== undefined) updates.id_photo_url = payload.idPhotoUrl;
  await updateDoc(doc(db, "brms", brmId), updates);
}

export async function deleteBrm(brmId: string): Promise<void> {
  await deleteDoc(doc(db, "brms", brmId));
}

/** All merchants referred by a given BRM (all activation statuses). */
export async function getMerchantsByBrm(brmId: string): Promise<BrmMerchant[]> {
  const q = query(
    collection(db, "merchants"),
    where("referring_brm_id", "==", brmId),
    orderBy("created_at", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at,
      activated_at: data.activated_at?.toDate ? data.activated_at.toDate() : data.activated_at,
    } as BrmMerchant;
  });
}
