export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status?: "active" | "inactive" | "suspended";
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
    status?: 'pending' | 'submitted' | 'approved' | 'rejected';
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
    [key: string]: {
      name?: string;
      path?: string;
      textData?: string;
      number?: string;
      value?: string;
    } | undefined;
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

export type AdminRole = "admin" | "customer_service";

export interface Admin {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  createdAt?: Date;
  lastLoginAt?: Date;
  status: "active" | "inactive";
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
  defaultTheme: 'light' | 'dark' | 'system';
  compactMode: boolean;
  enableShadows: boolean;
}

export interface Communication {
  id: string;
  title: string;
  body: string;
  audience: string;
  channels: Array<'email' | 'sms' | 'call'>;
  status: 'sent' | 'scheduled' | 'draft';
  sentAt?: Date;
  createdBy?: string;
}

export interface Permission {
  canViewDashboard: boolean;
  canManageUsers: boolean;
  canManageTransactions: boolean;
  canManageAdmins: boolean;
  canEditSettings: boolean;
}
