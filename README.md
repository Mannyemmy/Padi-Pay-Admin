# PadiPay Admin Dashboard

A modern, responsive admin dashboard for PadiPay - a payment and loan fintech platform. Built with Next.js 15, TypeScript, TailwindCSS, and Firebase.

## Features

### 🏠 Dashboard
- Total wallet balance overview
- Deposits and withdrawals statistics
- Pending withdrawals tracking
- User and transaction counts
- Interactive weekly activity chart
- Recent transactions table

### 👥 Users Management
- User listing with search and filters
- User details sidebar modal
- KYC status verification
- Account status management
- Wallet balance tracking
- Transaction history per user

### 💳 Transactions
- Complete transaction history
- Advanced filtering (status, type)
- Transaction detail modal
- Approve/reject pending transactions
- Support for multiple transaction types: deposits, withdrawals, transfers, loans, repayments

### 👨‍💼 Admin Management
- Role-based access control
- Four admin roles: Full Admin, Support, Finance, Viewer
- Permission management
- Activity logs
- Add/remove admins

### ⚙️ Settings
- Interest rate configuration
- Loan duration and rate mapping
- Transaction limits (withdrawal, deposit)
- KYC verification requirements
- Company information
- Support contact details

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS 4
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Charts**: Recharts
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd padi-pay-admin
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory (use `.env.local.example` as template):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password)
3. Create a Firestore database
4. Set up the following collections:
   - `users` - User profiles and wallet data
   - `transactions` - Transaction records
   - `admins` - Admin users and roles
   - `settings` - Platform configuration

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin-only access
    match /{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.status == 'active';
    }
  }
}
```

## Project Structure

```
padi-pay-admin/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Dashboard
│   ├── users/             # Users page
│   ├── transactions/      # Transactions page
│   ├── admins/            # Admin management
│   ├── settings/          # Settings page
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # Reusable components
│   ├── Sidebar.tsx        # Navigation sidebar
│   └── StatsCard.tsx      # Statistics card
├── lib/                   # Utilities and configuration
│   ├── firebase.ts        # Firebase initialization
│   └── types.ts           # TypeScript types
└── public/                # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Role Permissions

| Feature | Full Admin | Support | Finance | Viewer |
|---------|-----------|---------|---------|--------|
| View Dashboard | ✅ | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ✅ | ❌ | ❌ |
| Manage Transactions | ✅ | ❌ | ✅ | ❌ |
| Manage Admins | ✅ | ❌ | ❌ | ❌ |
| Edit Settings | ✅ | ❌ | ❌ | ❌ |

## Environment Variables

All Firebase configuration should be stored in `.env.local`:

- `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase API key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase storage bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - Firebase messaging sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID` - Firebase app ID

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms

Build the project and deploy the `.next` folder:

```bash
npm run build
npm start
```

## License

MIT License - feel free to use this project for your own purposes.

## Support

For support, email support@padipay.com or open an issue in the repository.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
