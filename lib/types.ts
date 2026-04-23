export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status?: "active" | "inactive" | "suspended";
  role?: "agent" | string;
  referralCode?: string;
  referralCount?: number;
  referredBy?: string | null;
  agentAssignedAt?: Date;
  bvn?: string;
  nin?: string;
  dateOfBirth?: string;
  gender?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  createdAt?: Date;
  expiryDate?: string;

  // Address info
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };

  // Banking - GetAnchor
  getAnchorData?: {
    virtualAccount?: {
      data?: {
        attributes?: {
          accountName?: string;
          accountNumber?: string;
          bank?: {
            name?: string;
            nipCode?: string;
          };
        };
      };
    };
  };

  // Wallet - StroWallet (NGN Card)
  stroWalletUser?: {
    data?: {
      customer_id?: string;
      status?: string;
    };
  };

  // USD Card - BridgeCard
  bridgeCard?: {
    cardholder_id?: string;
    is_active?: boolean;
  };

  // KYC Documents
  requiredDocuments?: Array<{
    anchorId?: string;
    type?: string;
    description?: string;
    fileName?: string;
    status?: "pending" | "submitted" | "approved" | "rejected";
    storagePath?: string;
  }>;

  businessIds?: string[];
}

export interface Business {
  id: string;
  ownerId: string; // User ID
  ownerName?: string;

  // Business data
  business_data?: {
    name: string;
    desc?: string;
    bvn?: string;
    bizAddress?: string;
    industry?: string;
    regType?: string;
    regDate?: string;
    regCity?: string;
    regState?: string;
  };

  // Contact data
  contact_data?: {
    email: string;
    phone: string;
    address?: string;
    city?: string;
    state?: string;
    postal?: number;
  };

  // Documents
  documents?: {
    BN_NUMBER?: {
      textData?: string;
    };
    CERTIFICATE_OF_BUSINESS_NAME?: {
      name?: string;
      path?: string;
    };
    FORM_CAC_BN_1?: {
      name?: string;
      path?: string;
    };
    PROOF_OF_ADDRESS?: {
      name?: string;
      path?: string;
    };
    [key: string]:
      | {
          name?: string;
          path?: string;
          textData?: string;
          number?: string;
          value?: string;
        }
      | undefined;
  };

  requiredDocuments?: Array<{
    anchorId?: string;
    type?: string;
    description?: string;
    status?: string;
    name?: string;
    path?: string;
    url?: string;
    fileUrl?: string;
    documentPath?: string;
    textData?: string;
    number?: string;
    value?: string;
  }>;

  // Banking - GetAnchor
  getAnchorData?: {
    virtualAccount?: {
      data?: {
        attributes?: {
          accountName?: string;
          accountNumber?: string;
          bank?: {
            name?: string;
            nipCode?: string;
          };
        };
        bank?: {
          name?: string;
          nipCode?: string;
        };
      };
    };
    kybVerification?: {
      data?: {
        attributes?: {
          kycStatus?: string;
        };
      };
    };
  };

  // Verification status
  kybCreation?: {
    data?: {
      attributes?: {
        detail?: {
          businessName?: string;
        };
      };
    };
  };
}

export interface Transaction {
  id: string;
  userId?: string;
  userName?: string;
  type: "deposit" | "withdrawal" | "transfer" | string;
  amount: number;
  status: "success" | "pending" | "failed" | "successful" | string;
  date?: Date | string | number;
  reference?: string;
  description?: string;
  [key: string]: any;
}

export type AdminRole = "admin" | "customer_service" | "compliance_officer";
// lib/types.ts
export interface Admin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "active" | "inactive";
  lastLoginAt?: number;
  createdAt: number;
  // Add permissions object
  permissions?: {
    [route: string]: boolean;
  };
}
export interface DashboardStats {
  totalBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  totalUsers: number;
  totalTransactions: number;
  weeklyActivity: { day: string; amount: number }[];
}

export interface Settings {
  companyName: string;
  supportEmail: string;
  supportPhone: string;
  primaryColor: string;
  accentColor: string;
  buttonRadius: number;
  defaultTheme: "light" | "dark" | "system";
  compactMode: boolean;
  enableShadows: boolean;
}

export interface Communication {
  id: string;
  title: string;
  body: string;
  audience: string;
  channels: Array<"email" | "sms" | "call">;
  status: "sent" | "scheduled" | "draft";
  sentAt?: Date;
  createdBy?: string;
}

export interface Referral {
  id: string;
  referrerUid: string;
  referrerName?: string;
  referredUid: string;
  referredName?: string;
  createdAt?: Date;
}

export interface Permission {
  canViewDashboard: boolean;
  canManageUsers: boolean;
  canManageTransactions: boolean;
  canManageAdmins: boolean;
  canEditSettings: boolean;
}

// BRM TYPES
export type BrmStatus = "active" | "suspended";
export type CommissionStatus = "accruing" | "pending" | "available" | "paid_out";
export type CommissionType = "referral_bonus" | "fee_commission";
export type CashoutStatus = "requested" | "processing" | "completed" | "failed";
export type MerchantActivationStatus =
  | "signed_up"
  | "kyc_pending"
  | "kyc_approved"
  | "activated"
  | "churned";

export interface Brm {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone: string;
  nin?: string;
  date_of_birth?: string;
  address?: string;
  state: string;
  lga: string;
  referral_code: string;
  status: BrmStatus;
  bank_account_number?: string;
  bank_name?: string;
  bank_account_name?: string;
  profile_photo_url?: string | null;
  id_photo_url?: string | null;
  created_at?: Date;
  updated_at?: Date;
  created_by?: string;
}

export interface BrmCommissionLedger {
  id: string;
  brm_id: string;
  merchant_id?: string;
  transaction_id?: string;
  type: CommissionType;
  gross_amount: number;
  commission_amount: number;
  status: CommissionStatus;
  reason?: string; // for manual adjustments
  created_at?: Date;
  settled_at?: Date;
  paid_out_at?: Date;
}

export interface BrmCashout {
  id: string;
  brm_id: string;
  brm_name?: string;
  amount: number;
  bank_account_number: string;
  bank_name: string;
  bank_account_name: string;
  status: CashoutStatus;
  failure_reason?: string;
  processed_by?: string;
  requested_at?: Date;
  processed_at?: Date;
}

export interface BrmMerchant {
  id: string;
  referring_brm_id: string;
  business_name: string;
  owner_name?: string;
  phone?: string;
  activation_status: MerchantActivationStatus;
  activation_transaction_count: number;
  referral_bonus_paid: boolean;
  activated_at?: Date;
  created_at?: Date;
}

// Define all available routes
export type AdminRoute =
  | "/"
  | "/users"
  | "/cards"
  | "/compliance-kyc"
  | "/login-logs"
  | "/blocked-logins"
  | "/analytics"
  | "/agents"
  | "/transactions"
  | "/referrals"
  | "/communications"
  | "/seo"
  | "/admins"
  | "/activity-logs"
  | "/settings"
  | "/data-tools"
  | "/brm-agents"
  | "/super-agents"
  | "/support-tickets";

export interface RouteInfo {
  name: string;
  href: AdminRoute;
  icon: any;
  category?: string;
}
export interface ActivityLog {
  id?: string;
  adminId: string;
  adminEmail: string;
  adminName: string;
  route: string;
  action: 'page_view' | 'api_call' | 'login' | 'logout';
  startTime: number; // timestamp in milliseconds
  endTime?: number; // timestamp in milliseconds
  duration?: number; // in milliseconds
  userAgent?: string;
  ipAddress?: string;
  method?: string; // HTTP method for API calls
  statusCode?: number; // HTTP status code
  metadata?: Record<string, any>;
  createdAt: number;
}
