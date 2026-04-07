import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import * as bcrypt from "bcryptjs";
import {generateMockData, cleanupMockData} from "./mockDataGenerator";

import * as crypto from "crypto";

// Initialize Firebase Admin
admin.initializeApp();

setGlobalOptions({maxInstances: 10});

// Note: Cloud Functions onCall handlers automatically handle CORS
// for authenticated Firebase clients. All allowed origins are permitted
// for onCall functions when called from Firebase SDK.

export const createAdminAccount = onCall(async (request) => {
  // Check if the caller is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  // Check if the caller is an admin
  const callerDoc = await admin
    .firestore()
    .collection("admins")
    .doc(request.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can create new admin accounts"
    );
  }

  const {email, name, role} = request.data;

  if (!email || !name || !role) {
    throw new HttpsError(
      "invalid-argument",
      "Email, name, and role are required"
    );
  }

  if (!["admin", "customer_service", "compliance_officer"].includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      "Role must be 'admin', 'customer_service', or 'compliance_officer'"
    );
  }

  try {
    // SECURITY: Use crypto.randomBytes for the temporary password — Math.random() is
    // not cryptographically secure. The user resets this immediately via the link below.
    const tempPassword = crypto.randomBytes(16).toString("hex");

    // Create the auth user
    const userRecord = await admin.auth().createUser({
      email,
      password: tempPassword,
      displayName: name,
    });

    logger.info(`Created admin account: ${userRecord.uid}`);

    // Send password reset email immediately
    const resetLink = await admin.auth().generatePasswordResetLink(email);
    logger.info(`Password reset link generated for ${email}`);

    return {uid: userRecord.uid, resetLink};
  } catch (error) {
    logger.error("Error creating admin account:", error);
    throw new HttpsError("internal", "Failed to create admin account");
  }
});

/**
 * Delete an admin account from Authentication and Firestore
 */
export const deleteAdminAccount = onCall(async (request) => {
  // Check if the caller is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  // Check if the caller is an admin
  const callerDoc = await admin
    .firestore()
    .collection("admins")
    .doc(request.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can delete admin accounts"
    );
  }

  const {uid} = request.data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID is required");
  }

  // Prevent self-deletion
  if (uid === request.auth.uid) {
    throw new HttpsError(
      "permission-denied",
      "You cannot delete your own account"
    );
  }

  try {
    // Delete from Firestore first
    await admin.firestore().collection("admins").doc(uid).delete();
    logger.info(`Deleted admin document from Firestore: ${uid}`);

    // Delete from Authentication
    await admin.auth().deleteUser(uid);
    logger.info(`Deleted admin account from Auth: ${uid}`);

    return {success: true};
  } catch (error) {
    logger.error("Error deleting admin account:", error);
    throw new HttpsError("internal", "Failed to delete admin account");
  }
});

/**
 * Update an admin account in Authentication and Firestore
 */
export const updateAdminAccount = onCall(async (request) => {
  // Check if the caller is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  // Check if the caller is an admin
  const callerDoc = await admin
    .firestore()
    .collection("admins")
    .doc(request.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can update admin accounts"
    );
  }

  const {uid, email, name} = request.data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID is required");
  }

  try {
    const updates: {email?: string; displayName?: string} = {};

    if (email) {
      updates.email = email;
    }
    if (name) {
      updates.displayName = name;
    }

    // Update in Authentication
    if (Object.keys(updates).length > 0) {
      await admin.auth().updateUser(uid, updates);
      logger.info(`Updated admin in Auth: ${uid}`);
    }

    // Update in Firestore
    const firestoreUpdates: {email?: string; name?: string} = {};
    if (email) firestoreUpdates.email = email;
    if (name) firestoreUpdates.name = name;

    if (Object.keys(firestoreUpdates).length > 0) {
      await admin.firestore()
        .collection("admins")
        .doc(uid)
        .update(firestoreUpdates);
      logger.info(`Updated admin in Firestore: ${uid}`);
    }

    return {success: true};
  } catch (error) {
    logger.error("Error updating admin account:", error);
    throw new HttpsError("internal", "Failed to update admin account");
  }
});

/**
 * Update user email in Authentication
 */
export const updateUserEmail = onCall(async (request) => {
  // Check if the caller is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  // SECURITY: Admin role check required — without this any authenticated user
  // (e.g. a regular app user) could update any other user's email, enabling
  // account takeover. All privileged write operations must verify role first.
  const callerDoc = await admin
    .firestore()
    .collection("admins")
    .doc(request.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can update user emails"
    );
  }

  const {userId, newEmail} = request.data;

  if (!userId || !newEmail) {
    throw new HttpsError(
      "invalid-argument",
      "User ID and new email are required"
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    throw new HttpsError("invalid-argument", "Invalid email format");
  }

  try {
    // Update user email in Firebase Authentication
    await admin.auth().updateUser(userId, {
      email: newEmail,
    });

    logger.info(`Updated user email in Auth: ${userId}`);

    return {success: true, message: "Email updated successfully"};
  } catch (error: any) {
    logger.error("Error updating user email in auth:", error);

    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", "User not found");
    }

    if (error.code === "auth/invalid-email") {
      throw new HttpsError("invalid-argument", "Invalid email address");
    }

    if (error.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "Email already in use"
      );
    }

    throw new HttpsError("internal", "Failed to update user email");
  }
});

/**
 * Send a push notification to a user by device token(s).
 * Caller must be authenticated and have 'admin' role.
 * Stores a notification record and queues it if no device token available.
 */
export const sendUserNotification = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  // Check that caller is admin
  const callerDoc = await admin
    .firestore()
    .collection("admins")
    .doc(request.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can send notifications");
  }

  const { userId, title, body } = request.data || {};

  if (!userId || !title || !body) {
    throw new HttpsError("invalid-argument", "userId, title and body are required");
  }

  // Load user document to fetch device token
  const userDocRef = admin.firestore().collection("users").doc(userId);
  const userDoc = await userDocRef.get();

  if (!userDoc.exists) {
    throw new HttpsError("not-found", "User not found");
  }

  const userData = userDoc.data() as any;
  const deviceToken = userData?.deviceToken;

  // Prepare notification record (persist regardless of delivery)
  const notificationRecord: Record<string, any> = {
    userId,
    title,
    body,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    delivered: false,
  };

  if (!deviceToken) {
    // Queue notification (no device token)
    await admin.firestore().collection("notifications").add(notificationRecord);
    logger.warn(`User ${userId} has no deviceToken; notification queued.`);
    return { success: false, queued: true, message: "User has no device token; notification queued." };
  }

  try {
    const tokens = Array.isArray(deviceToken) ? deviceToken : [deviceToken];

    // Build messages compatible with the current send API
    const messages = tokens.map((t: string) => ({
      token: t,
      notification: {
        title,
        body,
      },
      data: { userId: String(userId) },
      android: { priority: 'high' as const },
      apns: { headers: { "apns-priority": "10" } },
    }));

    // Send each message with the preferred `send` API and collect results
    const sendPromises = messages.map((msg) => admin.messaging().send(msg));
    const results = await Promise.allSettled(sendPromises);

    let successCount = 0;
    let failureCount = 0;
    const tokensToRemove: string[] = [];

    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        successCount += 1;
      } else {
        failureCount += 1;
        const err = (res as PromiseRejectedResult).reason;
        logger.error('FCM error for token', tokens[idx], err);
        const errCode = err?.code || err?.errorInfo?.code || null;
        if (
          errCode === 'messaging/invalid-registration-token' ||
          errCode === 'messaging/registration-token-not-registered'
        ) {
          tokensToRemove.push(tokens[idx]);
        }
      }
    });

    if (tokensToRemove.length > 0) {
      if (Array.isArray(deviceToken)) {
        const updated = deviceToken.filter((t: string) => !tokensToRemove.includes(t));
        if (updated.length > 0) {
          await userDocRef.update({ deviceToken: updated });
        } else {
          await userDocRef.update({ deviceToken: admin.firestore.FieldValue.delete() });
        }
      } else {
        // single token invalid -> remove field
        await userDocRef.update({ deviceToken: admin.firestore.FieldValue.delete() });
      }
    }

    // Persist notification record; mark delivered if we had at least one success
    notificationRecord.delivered = successCount > 0;
    await admin.firestore().collection("notifications").add(notificationRecord);

    return { success: true, successCount, failureCount };
  } catch (err: any) {
    logger.error("Error sending user notification:", err);
    // Save queued notification with error
    await admin.firestore().collection("notifications").add({
      ...notificationRecord,
      error: String(err),
    });
    throw new HttpsError("internal", "Failed to send notification");
  }
});

// ── Mock Data Generation ────────────────────────────────────────────────

/**
 * Scheduled function: runs every 1 minute but only generates data when
 * a randomised interval (2–6 minutes) has elapsed since the last run,
 * simulating organic, non-uniform user activity.
 */
export const scheduledMockDataGeneration = onSchedule(
  {schedule: "every 1 minutes", timeZone: "Africa/Lagos"},
  async () => {
    const db = admin.firestore();
    const metaRef = db.collection("_internal").doc("mockSchedule");

    try {
      const metaSnap = await metaRef.get();
      const now = Date.now();

      if (metaSnap.exists) {
        const data = metaSnap.data() as {
          lastRunTime: number;
          nextIntervalMs: number;
        };
        if (now - data.lastRunTime < data.nextIntervalMs) {
          // Not enough time has passed – skip this invocation
          return;
        }
      }

      const result = await generateMockData({
        users: 2,
        transactionsPerUser: 3,
        loginLogsPerUser: 2,
        blockedLogins: 1,
        activityLogs: 5,
        businesses: 1,
        referralChainLength: 1,
      });

      // Store timestamp and pick a random interval between 2 and 6 minutes
      const nextIntervalMs = (2 + Math.random() * 4) * 60 * 1000;
      await metaRef.set({lastRunTime: now, nextIntervalMs});

      logger.info("Scheduled mock data generation complete", {
        ...result,
        nextRunInMinutes: Math.round(nextIntervalMs / 60000 * 10) / 10,
      });
    } catch (err) {
      logger.error("Scheduled mock data generation failed", err);
    }
  },
);

/**
 * Callable: manually trigger mock data generation with custom config.
 * Only admins can call this.
 */
export const triggerMockDataGeneration = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const callerDoc = await admin
    .firestore()
    .collection("admins")
    .doc(request.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can trigger mock data generation"
    );
  }

  try {
    const config = request.data || {};
    const result = await generateMockData(config);
    return {success: true, ...result};
  } catch (err) {
    logger.error("Manual mock data generation failed", err);
    throw new HttpsError("internal", "Failed to generate mock data");
  }
});

/**
 * Callable: delete all mock data from Firestore.
 * Only admins can call this.
 */
export const triggerMockDataCleanup = onCall({memory: "1GiB", timeoutSeconds: 540}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const callerDoc = await admin
    .firestore()
    .collection("admins")
    .doc(request.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can cleanup mock data"
    );
  }

  try {
    const result = await cleanupMockData();
    if (Object.keys(result.errors).length > 0) {
      logger.error("Mock data cleanup finished with errors", result.errors);
    }
    return {success: true, ...result};
  } catch (err) {
    logger.error("Mock data cleanup failed", err);
    throw new HttpsError("internal", "Failed to cleanup mock data");
  }
});

/**
 * Create a new BRM (Business Relationship Manager) agent.
 * Credentials are stored in Firestore only (bcrypt-hashed password).
 * No Firebase Auth user is created — the agent logs in via brmLogin().
 * Only admin-role callers can invoke this.
 */
export const createBrmAgent = onCall(async (request) => {
  // Must be authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  // Caller must be an admin
  const callerDoc = await admin
    .firestore()
    .collection("admins")
    .doc(request.auth.uid)
    .get();

  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Only admins can create BRM agents"
    );
  }

  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    nin,
    dateOfBirth,
    address,
    state,
    lga,
    profilePhotoUrl,
    idPhotoUrl,
  } = request.data;

  // Basic validation
  if (!firstName || !lastName || !email || !password || !phone) {
    throw new HttpsError(
      "invalid-argument",
      "firstName, lastName, email, password and phone are required"
    );
  }

  if (password.length < 8) {
    throw new HttpsError(
      "invalid-argument",
      "Password must be at least 8 characters"
    );
  }

  // Generate unique referral code: PADI-BRM-XXXX
  // SECURITY: Use crypto.randomBytes for referral code generation.
  // Math.random() is not cryptographically secure and could be predicted.
  function generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    const randomBytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[randomBytes[i] % chars.length];
    }
    return `PADI-BRM-${code}`;
  }

  // Ensure uniqueness (retry up to 5 times)
  let referralCode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCode();
    const existing = await admin
      .firestore()
      .collection("brms")
      .where("referral_code", "==", candidate)
      .limit(1)
      .get();
    if (existing.empty) {
      referralCode = candidate;
      break;
    }
  }

  if (!referralCode) {
    throw new HttpsError("internal", "Could not generate a unique referral code");
  }

  // Check for existing BRM with same email before doing any heavy work
  const emailConflictSnap = await admin
    .firestore()
    .collection("brms")
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!emailConflictSnap.empty) {
    throw new HttpsError("already-exists", "A BRM agent with this email already exists");
  }

  // Hash the password with bcrypt (salt rounds = 12)
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    // Generate a Firestore doc ID as the BRM's uid (no Firebase Auth user created)
    const brmRef = admin.firestore().collection("brms").doc();
    const uid = brmRef.id;

    await brmRef.set({
      full_name: `${firstName} ${lastName}`,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      nin: nin ?? null,
      date_of_birth: dateOfBirth ?? null,
      address: address ?? null,
      state: state ?? null,
      lga: lga ?? null,
      profile_photo_url: profilePhotoUrl ?? null,
      id_photo_url: idPhotoUrl ?? null,
      referral_code: referralCode,
      password_hash: passwordHash,
      status: "active",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      created_by: request.auth!.uid,
    });

    logger.info(`Created BRM (Firestore-only) doc: ${uid}, code: ${referralCode}`);
    return {uid, referralCode};
  } catch (error: unknown) {
    logger.error("Error creating BRM agent:", error);
    throw new HttpsError("internal", "Failed to create BRM agent");
  }
});

/**
 * Authenticate a BRM agent using Firestore credentials (bcrypt-hashed password).
 * On success returns a Firebase Custom Token so the client can establish a
 * Firebase session without ever having called signInWithEmailAndPassword.
 * This function is intentionally unauthenticated — callers are logging in.
 */
export const brmLogin = onCall(async (request) => {
  const {email, password} = request.data;

  if (!email || !password) {
    throw new HttpsError("invalid-argument", "Email and password are required");
  }

  // Look up BRM by email
  const snap = await admin
    .firestore()
    .collection("brms")
    .where("email", "==", email)
    .limit(1)
    .get();

  // Use a generic message to avoid leaking whether the email exists
  if (snap.empty) {
    throw new HttpsError("unauthenticated", "Invalid email or password");
  }

  const brmDoc = snap.docs[0];
  const brm = brmDoc.data();

  if (brm.status === "suspended") {
    throw new HttpsError(
      "permission-denied",
      "Your account has been suspended. Please contact support."
    );
  }

  // Verify password against stored bcrypt hash
  const storedHash: string | undefined = brm.password_hash;
  if (!storedHash) {
    // Accounts created before the bcrypt migration have no hash
    logger.warn(`BRM ${brmDoc.id} has no password_hash — login rejected`);
    throw new HttpsError("unauthenticated", "Invalid email or password");
  }

  // SECURITY: Brute-force lockout for BRM login.
  // bcrypt.compare is intentionally slow, but an attacker can still flood
  // requests in parallel. Track failures in Firestore and lock for 15 minutes
  // after 5 consecutive failures to slow credential-stuffing attacks.
  const failedAttempts = (brm.failedLoginAttempts || 0);
  const lockedUntil = brm.lockedUntil || 0;

  if (lockedUntil > Date.now()) {
    const minutesLeft = Math.ceil((lockedUntil - Date.now()) / 60000);
    throw new HttpsError(
      "resource-exhausted",
      `Account temporarily locked. Try again in ${minutesLeft} minute(s).`
    );
  }

  const match = await bcrypt.compare(password, storedHash);
  if (!match) {
    const newAttempts = failedAttempts + 1;
    const updateData: Record<string, any> = {failedLoginAttempts: newAttempts};
    if (newAttempts >= 5) {
      updateData.lockedUntil = Date.now() + 15 * 60 * 1000; // lock 15 minutes
    }
    await brmDoc.ref.update(updateData);
    throw new HttpsError("unauthenticated", "Invalid email or password");
  }

  // Reset failed attempts on successful login
  if (failedAttempts > 0) {
    await brmDoc.ref.update({failedLoginAttempts: 0, lockedUntil: 0});
  }

  // Issue a Firebase Custom Token so the client can use signInWithCustomToken.
  // This gives the BRM a valid Firebase session (for Firestore reads) without
  // ever storing credentials in Firebase Auth.
  const customToken = await admin.auth().createCustomToken(brmDoc.id, {
    brm: true,
  });

  logger.info(`BRM login success: ${brmDoc.id}`);
  return {
    customToken,
    uid: brmDoc.id,
    referralCode: brm.referral_code ?? null,
  };
});

/**
 * Reset a BRM password using an OTP previously emailed via the centralized
 * sendEmailOTP function with purpose="password_reset".
 */
export const resetBrmPasswordWithOtp = onCall(async (request) => {
  const {email, pinId, code, newPassword} = request.data;

  if (!email || !pinId || !code || !newPassword) {
    throw new HttpsError(
      "invalid-argument",
      "email, pinId, code and newPassword are required"
    );
  }

  if (newPassword.length < 8) {
    throw new HttpsError(
      "invalid-argument",
      "New password must be at least 8 characters"
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const otpRef = admin.firestore().collection("emailOtps").doc(String(pinId));
  const otpSnap = await otpRef.get();

  if (!otpSnap.exists) {
    throw new HttpsError("not-found", "OTP request was not found");
  }

  const otp = otpSnap.data();
  if (!otp) {
    throw new HttpsError("not-found", "OTP request was not found");
  }
  if (otp.used) {
    throw new HttpsError("failed-precondition", "OTP has already been used");
  }
  if (Date.now() > otp.expiresAt) {
    throw new HttpsError("deadline-exceeded", "OTP has expired");
  }
  if (String(otp.email).trim().toLowerCase() !== normalizedEmail) {
    throw new HttpsError("permission-denied", "OTP does not match this email");
  }
  if (otp.purpose !== "password_reset") {
    throw new HttpsError("failed-precondition", "OTP is not valid for password reset");
  }

  const MAX_ATTEMPTS = 5;
  const attempts = (otp.attempts || 0) + 1;
  if (attempts > MAX_ATTEMPTS) {
    await otpRef.update({used: true});
    throw new HttpsError("resource-exhausted", "Too many incorrect attempts. Request a new OTP.");
  }

  if (String(otp.code) !== String(code).trim()) {
    await otpRef.update({attempts});
    throw new HttpsError("unauthenticated", "Invalid OTP code");
  }

  const brmSnap = await admin
    .firestore()
    .collection("brms")
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (brmSnap.empty) {
    throw new HttpsError("not-found", "No BRM account found for this email");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const brmRef = brmSnap.docs[0].ref;

  await admin.firestore().runTransaction(async (tx) => {
    tx.update(brmRef, {
      password_hash: passwordHash,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.update(otpRef, {
      used: true,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  logger.info(`BRM password reset via OTP: ${brmRef.id}`);
  return {success: true};
});

/**
 * Change a BRM agent's own password while authenticated.
 * Verifies the current password before updating the bcrypt hash in Firestore.
 * Caller must be authenticated as a BRM (custom token session).
 */
export const changeBrmPassword = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const {currentPassword, newPassword} = request.data;

  if (!currentPassword || !newPassword) {
    throw new HttpsError(
      "invalid-argument",
      "currentPassword and newPassword are required"
    );
  }

  if (newPassword.length < 8) {
    throw new HttpsError(
      "invalid-argument",
      "New password must be at least 8 characters"
    );
  }

  if (currentPassword === newPassword) {
    throw new HttpsError(
      "invalid-argument",
      "New password must differ from the current password"
    );
  }

  // Fetch BRM doc by uid (the uid embedded in the custom token)
  const brmRef = admin.firestore().collection("brms").doc(request.auth.uid);
  const brmSnap = await brmRef.get();

  if (!brmSnap.exists) {
    throw new HttpsError("not-found", "BRM account not found");
  }

  const brm = brmSnap.data()!;

  if (brm.status === "suspended") {
    throw new HttpsError("permission-denied", "Account is suspended");
  }

  const storedHash: string | undefined = brm.password_hash;
  if (!storedHash) {
    throw new HttpsError(
      "failed-precondition",
      "No password is set for this account — use the reset flow instead"
    );
  }

  const match = await bcrypt.compare(currentPassword, storedHash);
  if (!match) {
    throw new HttpsError("unauthenticated", "Current password is incorrect");
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await brmRef.update({
    password_hash: newHash,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info(`BRM password changed by self: ${request.auth.uid}`);
  return {success: true};
});


 /* Balance is a random mock value stored directly; no Anchor API call needed.
 */
export const seedCompanyAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }
  const callerDoc = await admin
    .firestore()
    .collection("admins")
    .doc(request.auth.uid)
    .get();
  if (!callerDoc.exists || callerDoc.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Only admins can seed company account");
  }

  const randInt = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;
  const accountNumber = Array.from({length: 10}, () => randInt(0, 9)).join("");
  // Balance is stored in kobo (×100) to match Anchor API convention
  const availableBalance = randInt(500000, 5000000) * 100;

  await admin.firestore().collection("company").doc("account_details").set({
    accountNumber,
    bankName: "9 Payment Service Bank",
    bankNipCode: "120001",
    // No real Anchor accountId — balance served from this doc directly
    availableBalance,
    ledgerBalance: availableBalance,
    hold: 0,
    pending: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  logger.info("Company account seeded", {accountNumber, availableBalance});
  return {success: true, accountNumber, availableBalance};
});

/**
 * Triggered whenever a new transaction doc is written to the `transactions`
 * collection. If it is a successful ATM payment from a BRM-referred merchant,
 * this function:
 *  1. Increments the merchant’s activation_transaction_count.
 *  2. Updates last_transaction_at on the merchant doc.
 *  3. Awards a \u20a65,000 referral bonus when the count first hits 10.
 *  4. Records 50 % of padipay_fee_naira as a fee_commission ledger entry.
 */
export const onTransactionCreated = onDocumentCreated(
  "transactions/{txId}",
  async (event) => {
    const tx = event.data?.data();
    if (!tx) return;

    // Only process successful ATM payments
    if (tx["type"] !== "atm_payment" || tx["status"] !== "success") return;

    const userId: string | undefined = tx["userId"];
    if (!userId) return;

    const db = admin.firestore();

    // Look up the merchant doc (doc ID == Firebase Auth UID of the merchant)
    const merchantRef = db.collection("merchants").doc(userId);
    const merchantSnap = await merchantRef.get();
    if (!merchantSnap.exists) return; // not a BRM-referred merchant

    const merchant = merchantSnap.data()!;
    const brmId: string | undefined = merchant["referring_brm_id"];
    if (!brmId) return;

    const feeNaira: number = typeof tx["padipay_fee_naira"] === "number"
      ? tx["padipay_fee_naira"]
      : 0;

    const currentCount: number = merchant["activation_transaction_count"] ?? 0;
    const newCount = currentCount + 1;
    const referralBonusPaid: boolean = merchant["referral_bonus_paid"] ?? false;

    const batch = db.batch();

    // 1. Update merchant tracking fields
    const merchantUpdate: Record<string, unknown> = {
      activation_transaction_count: newCount,
      last_transaction_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 2. Referral bonus at 10 transactions
    if (newCount >= 10 && !referralBonusPaid) {
      merchantUpdate["activation_status"] = "activated";
      merchantUpdate["referral_bonus_paid"] = true;
      merchantUpdate["activated_at"] = admin.firestore.FieldValue.serverTimestamp();

      const bonusRef = db.collection("brm_commission_ledger").doc();
      batch.set(bonusRef, {
        brm_id: brmId,
        merchant_id: userId,
        type: "referral_bonus",
        gross_amount: 5000,
        commission_amount: 5000,
        status: "available",
        description: `Referral bonus — ${merchant["business_name"] ?? userId}`,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info(`BRM ${brmId} referral bonus awarded for merchant ${userId}`);
    } else if (newCount < 10 && merchant["activation_status"] === "kyc_approved") {
      // already kyc_approved, just tracking count — no status change needed
    } else if (newCount === 1 && merchant["activation_status"] === "signed_up") {
      // First transaction — bump to kyc_approved if still at signed_up
      // (KYC happens outside this trigger, but keep activation_status consistent)
    }

    batch.update(merchantRef, merchantUpdate);

    // 3. Fee commission (50 % of PadiPay fee)
    if (feeNaira > 0) {
      const commissionAmount = Math.round(feeNaira * 0.5 * 100) / 100;
      const commissionRef = db.collection("brm_commission_ledger").doc();
      batch.set(commissionRef, {
        brm_id: brmId,
        merchant_id: userId,
        transaction_id: event.data?.id,
        type: "fee_commission",
        gross_amount: feeNaira,
        commission_amount: commissionAmount,
        status: "accruing",
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    logger.info(
      `BRM commission processed: brm=${brmId} merchant=${userId} count=${newCount} fee=\u20a6${feeNaira}`
    );
  }
);

