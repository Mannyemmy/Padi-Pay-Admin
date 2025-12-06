import { AdminRole, Permission } from './types';

export const rolePermissions: Record<AdminRole, Permission> = {
  full_admin: {
    canViewDashboard: true,
    canManageUsers: true,
    canManageTransactions: true,
    canManageAdmins: true,
    canEditSettings: true,
  },
  support: {
    canViewDashboard: true,
    canManageUsers: true,
    canManageTransactions: false,
    canManageAdmins: false,
    canEditSettings: false,
  },
  finance: {
    canViewDashboard: true,
    canManageUsers: false,
    canManageTransactions: true,
    canManageAdmins: false,
    canEditSettings: false,
  },
  viewer: {
    canViewDashboard: true,
    canManageUsers: false,
    canManageTransactions: false,
    canManageAdmins: false,
    canEditSettings: false,
  },
};

export function getPermissions(role: AdminRole): Permission {
  return rolePermissions[role];
}

export function hasPermission(role: AdminRole, permission: keyof Permission): boolean {
  return rolePermissions[role][permission];
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatPhoneNumber = (phone: string): string => {
  // Nigerian phone number formatting
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+234 ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};
