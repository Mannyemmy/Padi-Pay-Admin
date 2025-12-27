import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

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

  if (!["admin", "customer_service"].includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      "Role must be 'admin' or 'customer_service'"
    );
  }

  try {
    // Generate a random password (user will reset it via email)
    const tempPassword = Math.random().toString(36).slice(-12) +
      Math.random().toString(36).slice(-12);

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

