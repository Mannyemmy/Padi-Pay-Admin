# PadiPay Admin Dashboard - Implementation Guide

## Overview

The PadiPay Admin Dashboard is a complete admin interface for managing a payment and loan fintech platform. This guide covers the setup, features, and integration points.

## Completed Features

✅ **Dashboard**
- Wallet balance overview
- Transaction statistics
- User metrics
- Interactive weekly activity chart
- Recent transactions table

✅ **Users Management**
- Complete user list with search
- Advanced filtering (active/inactive/verified)
- User detail sidebar with full information
- KYC document tracking
- Account status management
- Transaction history per user

✅ **Transactions Management**
- Full transaction history
- Multiple filter options (status, type)
- Transaction detail modal
- Approval/rejection capabilities
- Support for all transaction types

✅ **Admin Management**
- Admin user listing
- Role-based access control (RBAC)
- 4 role types: Full Admin, Support, Finance, Viewer
- Permission matrix display
- Add new admins
- Activity logs

✅ **Settings Management**
- Interest rate configuration
- Loan duration and rate mapping
- Transaction limits
- KYC requirements toggle
- Company information
- Support contact management

## Project Structure

```
padi-pay-admin/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── users/page.tsx              # Users management
│   ├── transactions/page.tsx       # Transactions
│   ├── admins/page.tsx             # Admin management
│   ├── settings/page.tsx           # Settings
│   ├── layout.tsx                  # Root layout with sidebar
│   └── globals.css                 # Global styles
├── components/
│   ├── Sidebar.tsx                 # Navigation sidebar
│   ├── StatsCard.tsx               # Reusable stats card
│   ├── PageHeader.tsx              # Page header component
│   ├── Loading.tsx                 # Loading spinner
│   └── Error.tsx                   # Error display component
├── lib/
│   ├── firebase.ts                 # Firebase initialization
│   ├── firestore.ts                # Firestore operations
│   ├── types.ts                    # TypeScript interfaces
│   └── utils.ts                    # Helper functions
├── public/                         # Static assets
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
├── next.config.ts                  # Next.js config
└── README.md                       # Documentation
```

## Quick Start

### 1. Install Dependencies

```bash
cd d:\Dev\padi-pay-admin
npm install
```

If you encounter PowerShell execution policy errors on Windows, use:
```bash
npm install --no-save
```

### 2. Configure Firebase

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_value
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_value
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_value
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_value
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_value
NEXT_PUBLIC_FIREBASE_APP_ID=your_value
```

### 3. Run Development Server

```bash
npm run dev
```

Visit: http://localhost:3000

## Firebase Collections Setup

Create these Firestore collections and add documents:

### `users` Collection
```json
{
  "id": "user_001",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+234 801 234 5678",
  "balance": 125000,
  "status": "active",
  "kycStatus": "verified",
  "createdAt": "2024-01-15T00:00:00Z",
  "address": "123 Lagos Street",
  "bvn": "22234567890"
}
```

### `transactions` Collection
```json
{
  "id": "txn_001",
  "userId": "user_001",
  "userName": "John Doe",
  "type": "deposit",
  "amount": 50000,
  "status": "success",
  "date": "2024-12-05T10:30:00Z",
  "reference": "REF-2024-001",
  "description": "Bank transfer"
}
```

### `admins` Collection
```json
{
  "id": "admin_001",
  "name": "Admin User",
  "email": "admin@padipay.com",
  "role": "full_admin",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00Z",
  "lastActive": "2024-12-05T10:30:00Z"
}
```

### `settings` Collection
```json
{
  "id": "config",
  "interestRate": 5.5,
  "withdrawalLimit": 500000,
  "minimumDeposit": 1000,
  "kycRequired": true,
  "companyName": "PadiPay",
  "supportEmail": "support@padipay.com",
  "supportPhone": "+234 800 123 4567",
  "loanDurations": [
    { "months": 3, "rate": 5.5 },
    { "months": 6, "rate": 6.0 },
    { "months": 12, "rate": 7.0 },
    { "months": 24, "rate": 8.5 }
  ]
}
```

## Role-Based Access Control

### Permissions Matrix

| Feature | Full Admin | Support | Finance | Viewer |
|---------|:----------:|:-------:|:-------:|:------:|
| View Dashboard | ✅ | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ✅ | ❌ | ❌ |
| View Transactions | ✅ | ✅ | ✅ | ✅ |
| Manage Transactions | ✅ | ❌ | ✅ | ❌ |
| Manage Admins | ✅ | ❌ | ❌ | ❌ |
| Edit Settings | ✅ | ❌ | ❌ | ❌ |

### Implementation in Firestore

```typescript
const rolePermissions = {
  full_admin: {
    canViewDashboard: true,
    canManageUsers: true,
    canManageTransactions: true,
    canManageAdmins: true,
    canEditSettings: true,
  },
  // ... other roles
};
```

## API Integration Points

The dashboard uses these main API operations through `lib/firestore.ts`:

### User Operations
- `getUsers()` - Fetch all users
- `getUser(userId)` - Get specific user
- `updateUserStatus(userId, status)` - Update user status

### Transaction Operations
- `getTransactions()` - Fetch all transactions
- `getTransaction(transactionId)` - Get specific transaction
- `getTransactionsByUser(userId)` - Get user's transactions
- `updateTransactionStatus(transactionId, status)` - Update transaction

### Admin Operations
- `getAdmins()` - Fetch all admins
- `createAdmin(data)` - Create new admin
- `deleteAdmin(adminId)` - Remove admin

### Settings Operations
- `getSettings()` - Fetch current settings
- `updateSettings(data)` - Update platform settings

### Dashboard
- `getDashboardStats()` - Get all dashboard statistics

## Development Workflow

### Adding a New Page

1. Create page in `app/[page]/page.tsx`
2. Use 'use client' directive for client components
3. Import necessary icons from lucide-react
4. Add navigation link in `components/Sidebar.tsx`

### Adding Firebase Integration

1. Define types in `lib/types.ts`
2. Create operations in `lib/firestore.ts`
3. Import and use in component

### Styling

The project uses TailwindCSS 4 with utility-first approach. Key patterns:

```tsx
// Cards
className="bg-white rounded-lg border border-gray-200 p-6"

// Buttons
className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"

// Status badges
className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800"
```

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import repository in Vercel
3. Set environment variables
4. Deploy automatically

### Build & Run

```bash
npm run build
npm start
```

## Useful Commands

```bash
# Development
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint code
npm run lint

# Format code (if Prettier configured)
npm run format
```

## Troubleshooting

### Issue: PowerShell execution policy error
**Solution:** Use `cmd` terminal or bypass with `npm install --no-save`

### Issue: Firebase connection fails
**Solution:** Verify `.env.local` has correct Firebase credentials

### Issue: Styles not applying
**Solution:** Ensure Tailwind is properly configured in `globals.css`

### Issue: Components not showing
**Solution:** Check 'use client' directive for client components

## Next Steps

1. **Connect Firebase Authentication**
   - Add login page
   - Implement auth guards
   - Add logout functionality

2. **Add Real-time Updates**
   - Set up Firestore listeners
   - Implement auto-refresh
   - Add real-time notifications

3. **Enhanced Features**
   - Export data to CSV/PDF
   - Advanced reporting
   - Bulk operations
   - Activity logging

4. **Performance**
   - Add pagination
   - Implement caching
   - Optimize images
   - Add loading states

5. **Security**
   - Implement rate limiting
   - Add audit logging
   - Secure sensitive operations
   - Add 2FA for admins

## Support & Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Recharts Documentation](https://recharts.org)
- [Lucide Icons](https://lucide.dev)

## License

MIT License - Use freely in your projects
