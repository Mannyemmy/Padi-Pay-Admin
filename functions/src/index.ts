import {setGlobalOptions} from "firebase-functions/v2";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Initialize Firebase Admin
admin.initializeApp();

setGlobalOptions({maxInstances: 10});

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
