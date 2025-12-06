# Firebase Firestore Data Structure

This document shows the exact structure to set up in your Firebase Firestore database.

## Collections Overview

### 1. `users` Collection

**Document ID**: `user_001` (or any unique ID)

```json
{
  "id": "user_001",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "phone": "+234 801 234 5678",
  "status": "active",
  "balance": 125000,
  "kycStatus": "verified",
  "createdAt": Timestamp(2024, 1, 15, 0, 0, 0),
  "profileImage": "https://...",
  "address": "123 Lagos Street, Lagos",
  "bvn": "22234567890",
  "nin": "12345678901"
}
```

**Fields Explanation**:
- `id`: Unique user identifier
- `name`: Full name
- `email`: Email address
- `phone`: Mobile number
- `status`: "active" | "inactive" | "suspended"
- `balance`: Wallet balance in Naira
- `kycStatus`: "pending" | "verified" | "rejected"
- `createdAt`: Registration date
- `address`: Physical address (optional)
- `bvn`: Bank Verification Number (optional)
- `nin`: National ID Number (optional)

---

### 2. `transactions` Collection

**Document ID**: `txn_001` (or any unique ID)

```json
{
  "id": "txn_001",
  "userId": "user_001",
  "userName": "John Doe",
  "type": "deposit",
  "amount": 50000,
  "status": "success",
  "date": Timestamp(2024, 12, 5, 10, 30, 0),
  "reference": "REF-2024-001",
  "description": "Bank transfer deposit",
  "bankName": "First Bank",
  "accountNumber": "1234567890"
}
```

**Fields Explanation**:
- `id`: Transaction ID
- `userId`: User ID reference
- `userName`: User's name (denormalized for easy display)
- `type`: "deposit" | "withdrawal" | "transfer" | "loan" | "repayment"
- `amount`: Transaction amount in Naira
- `status`: "success" | "pending" | "failed"
- `date`: Transaction timestamp
- `reference`: Unique reference number
- `description`: Transaction details
- `bankName`: Bank name (for withdrawals)
- `accountNumber`: Account number (for transfers)

---

### 3. `admins` Collection

**Document ID**: `admin_001` (or use Firebase Auth UID)

```json
{
  "id": "admin_001",
  "name": "Admin User",
  "email": "admin@padipay.com",
  "role": "full_admin",
  "status": "active",
  "createdAt": Timestamp(2024, 1, 1, 0, 0, 0),
  "lastActive": Timestamp(2024, 12, 5, 10, 30, 0),
  "phone": "+234 800 123 4567"
}
```

**Fields Explanation**:
- `id`: Admin user ID (should match Firebase Auth UID)
- `name`: Full name
- `email`: Email address
- `role`: "full_admin" | "support" | "finance" | "viewer"
- `status`: "active" | "inactive"
- `createdAt`: Account creation date
- `lastActive`: Last login/activity timestamp
- `phone`: Contact number

---

### 4. `settings` Collection

**Document ID**: `config` (single document)

```json
{
  "interestRate": 5.5,
  "withdrawalLimit": 500000,
  "minimumDeposit": 1000,
  "kycRequired": true,
  "companyName": "PadiPay",
  "supportEmail": "support@padipay.com",
  "supportPhone": "+234 800 123 4567",
  "supportAddress": "123 Business Way, Lagos",
  "bankName": "Access Bank",
  "bankAccount": "1234567890",
  "bankCode": "044",
  "loanDurations": [
    {
      "months": 3,
      "rate": 5.5
    },
    {
      "months": 6,
      "rate": 6.0
    },
    {
      "months": 12,
      "rate": 7.0
    },
    {
      "months": 24,
      "rate": 8.5
    }
  ],
  "updatedAt": Timestamp(2024, 12, 5, 0, 0, 0),
  "updatedBy": "admin_001"
}
```

**Fields Explanation**:
- `interestRate`: Default interest rate (%)
- `withdrawalLimit`: Maximum withdrawal amount
- `minimumDeposit`: Minimum deposit amount
- `kycRequired`: Toggle KYC requirement
- `companyName`: Organization name
- `supportEmail`: Support email
- `supportPhone`: Support phone
- `supportAddress`: Office address
- `bankName`: Bank for settlements
- `bankAccount`: Account number
- `bankCode`: Bank code
- `loanDurations`: Array of duration and rate objects
- `updatedAt`: Last modification timestamp
- `updatedBy`: ID of admin who made changes

---

### 5. `activities` Collection (Optional - Activity Logging)

**Document ID**: Auto-generated

```json
{
  "adminId": "admin_001",
  "adminName": "Admin User",
  "action": "Updated user status",
  "targetType": "user",
  "targetId": "user_001",
  "targetName": "John Doe",
  "changes": {
    "status": {
      "from": "inactive",
      "to": "active"
    }
  },
  "timestamp": Timestamp(2024, 12, 5, 10, 30, 0),
  "ipAddress": "192.168.1.1"
}
```

---

## Setup Steps in Firebase Console

### 1. Create Collections

In Firebase Console:
1. Go to Firestore Database
2. Click "Create Collection"
3. Create the following collections:
   - `users`
   - `transactions`
   - `admins`
   - `settings`
   - `activities` (optional)

### 2. Set Firestore Security Rules

Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin-only access
    match /{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.status == 'active';
    }
    
    // Public read access for specific collections (optional)
    match /settings/config {
      allow read: if true;
      allow write: if isAdmin();
    }
    
    // User access to their own data
    match /users/{userId} {
      allow read: if request.auth.uid == userId || isAdmin();
      allow write: if isAdmin();
    }
    
    // Transaction access
    match /transactions/{transactionId} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
  }
  
  function isAdmin() {
    return request.auth != null && 
      get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.status == 'active';
  }
}
```

### 3. Create Sample Data (Optional)

In Firestore Console, manually add sample documents following the structures above.

### 4. Configure Firebase Authentication

1. Go to Authentication > Sign-in method
2. Enable Email/Password
3. Create test admin user with UID matching `admins` collection

---

## Database Indexes (Optional but Recommended)

For optimal query performance, create these composite indexes:

### Index 1: Users
- Collection: `users`
- Fields:
  - `status` (Ascending)
  - `createdAt` (Descending)

### Index 2: Transactions
- Collection: `transactions`
- Fields:
  - `status` (Ascending)
  - `date` (Descending)

### Index 3: User Transactions
- Collection: `transactions`
- Fields:
  - `userId` (Ascending)
  - `date` (Descending)

---

## Example Seed Data Script

Save as `seed-firestore.js` and run with Firebase CLI:

```javascript
const admin = require('firebase-admin');

admin.initializeApp({
  // Your Firebase config
});

const db = admin.firestore();

async function seedDatabase() {
  // Add users
  await db.collection('users').doc('user_001').set({
    id: 'user_001',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+234 801 234 5678',
    status: 'active',
    balance: 125000,
    kycStatus: 'verified',
    createdAt: admin.firestore.Timestamp.now(),
    address: '123 Lagos Street',
    bvn: '22234567890'
  });

  // Add admin
  await db.collection('admins').doc('admin_001').set({
    id: 'admin_001',
    name: 'Admin User',
    email: 'admin@padipay.com',
    role: 'full_admin',
    status: 'active',
    createdAt: admin.firestore.Timestamp.now(),
    lastActive: admin.firestore.Timestamp.now()
  });

  // Add settings
  await db.collection('settings').doc('config').set({
    interestRate: 5.5,
    withdrawalLimit: 500000,
    minimumDeposit: 1000,
    kycRequired: true,
    companyName: 'PadiPay',
    supportEmail: 'support@padipay.com',
    supportPhone: '+234 800 123 4567',
    loanDurations: [
      { months: 3, rate: 5.5 },
      { months: 6, rate: 6.0 },
      { months: 12, rate: 7.0 },
      { months: 24, rate: 8.5 }
    ]
  });

  console.log('Database seeded successfully!');
}

seedDatabase().catch(console.error);
```

---

## Querying Data

Use these queries in the dashboard (already implemented in `lib/firestore.ts`):

```typescript
// Get all users
const users = await db.collection('users').orderBy('createdAt', 'desc').get();

// Get user transactions
const transactions = await db.collection('transactions')
  .where('userId', '==', userId)
  .orderBy('date', 'desc')
  .limit(10)
  .get();

// Get pending transactions
const pending = await db.collection('transactions')
  .where('status', '==', 'pending')
  .get();

// Get settings
const settings = await db.collection('settings').doc('config').get();
```

---

## Next Steps

1. Create Firebase project at console.firebase.google.com
2. Set up Firestore database
3. Create collections
4. Add sample data
5. Configure security rules
6. Update `.env.local` with Firebase credentials
7. Run the admin dashboard

That's it! Your dashboard is ready to connect to Firebase. 🚀
