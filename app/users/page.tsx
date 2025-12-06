'use client';

import { useState, useEffect } from 'react';
import { Search, X, CheckCircle, FileText, Building2, User as UserIcon, Loader, Edit2, Trash2, Phone, Mail, Lock, Unlock } from 'lucide-react';
import { ref, getDownloadURL } from 'firebase/storage';
import { User, Business, Transaction } from '@/lib/types';
import { getUsers, getBusinesses, getTransactionsByUser, freezeAccount, unFreezeAccount, deleteUser, updateUserProfile, contactUser } from '@/lib/firestore';
import { storage } from '@/lib/firebase';
import { showToast } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';

type TabType = 'users' | 'businesses';

const getCurrencySymbol = (currency?: string): string => {
  if (!currency) return '₦'; // Default to Naira
  
  const currencyLower = currency.toLowerCase();
  if (currencyLower.includes('usd') || currencyLower.includes('dollar')) return '$';
  if (currencyLower.includes('eur') || currencyLower.includes('euro')) return '€';
  if (currencyLower.includes('gbp') || currencyLower.includes('pound')) return '£';
  if (currencyLower.includes('ngn') || currencyLower.includes('naira')) return '₦';
  
  return '₦'; // Default fallback
};

const formatAmount = (amount: number, currency?: string): string => {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${Number(amount || 0).toLocaleString()}`;
};

const formatTransactionType = (type?: string): string => {
  if (!type) return 'N/A';
  const typeLower = type.toLowerCase();
  if (typeLower === 'fund') return 'Card Funding';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

// Build a public download URL for a Firebase Storage path
const toStorageUrl = (path?: string) => {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  if (!storageBucket) return undefined;
  return `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(path)}?alt=media`;
};

const getDocInfo = (business: Business, docType?: string) => {
  if (!docType)
    return {} as { number?: string; value?: string; path?: string; name?: string; rawPath?: string };

  // Support both nested documents map and flat root fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rootDoc = (business as any)[docType] || (business.documents as any)?.[docType];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const numberVal = (rootDoc as any)?.textData || (rootDoc as any)?.number || (rootDoc as any)?.value;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPath = (rootDoc as any)?.path;
  const path = toStorageUrl(rawPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const name = (rootDoc as any)?.name;

  return { number: numberVal, path, name, rawPath } as {
    number?: string;
    path?: string;
    name?: string;
    rawPath?: string;
  };
};

// Helper function to determine KYC approval status
function getKYCStatus(user: User): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tier = (user.getAnchorData as any)?.tier;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kycStatus = (user as any).kycStatus;
  
  // Tier 2 is always approved
  if (tier === 2) {
    return true;
  }
  
  // Tier 3 requires kycStatus to be APPROVED (check root level first, then nested)
  if (tier === 3) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return kycStatus === 'APPROVED' || (user.getAnchorData as any)?.kycStatus === 'APPROVED';
  }
  
  // Other tiers check root level kycStatus
  return kycStatus === 'APPROVED';
}

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [docLinks, setDocLinks] = useState<Record<string, string>>({});
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [showAllUserTransactions, setShowAllUserTransactions] = useState(false);
  const [selectedUserTransaction, setSelectedUserTransaction] = useState<Transaction | null>(null);
  const [businessTransactions, setBusinessTransactions] = useState<Transaction[]>([]);
  const [showAllBusinessTransactions, setShowAllBusinessTransactions] = useState(false);
  const [selectedBusinessTransaction, setSelectedBusinessTransaction] = useState<Transaction | null>(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [usersPageSize, setUsersPageSize] = useState<number>(10);
  const [usersCurrentPage, setUsersCurrentPage] = useState<number>(1);
  const [businessesPageSize, setBusinessesPageSize] = useState<number>(10);
  const [businessesCurrentPage, setBusinessesCurrentPage] = useState<number>(1);
  const [userDocLinks, setUserDocLinks] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [freezeConfirm, setFreezeConfirm] = useState<string | null>(null);
  const [freezeReason, setFreezeReason] = useState('');
  const [freezeDescription, setFreezeDescription] = useState('');
  const [contactModal, setContactModal] = useState<{ userId: string } | null>(null);
  const [contactMessage, setContactMessage] = useState('');
  const [contactChannel, setContactChannel] = useState<'email' | 'sms'>('email');
  const [editModal, setEditModal] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<User>>({});
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersData, businessesData] = await Promise.all([
          getUsers(),
          getBusinesses(),
        ]);

        console.log('Raw users data:', usersData);
        console.log('Raw businesses data:', businessesData);

        // Normalize owner linkage: prefer explicit ownerId, otherwise doc id
        const businessesWithOwnerNames = businessesData.map((business) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ownerId = (business as any).ownerId as string || business.id;
          const owner = usersData.find((u) => u.id === ownerId);
          return {
            ...business,
            ownerId,
            ownerName: owner
              ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim()
              : 'Unknown Owner',
          };
        });

        // Map business IDs for users using normalized ownerId
        const usersWithBusinessIds = usersData.map((user) => {
          const userBusinesses = businessesWithOwnerNames.filter((b) => b.ownerId === user.id);
          return {
            ...user,
            businessIds: userBusinesses.map((b) => b.id),
          };
        });

        setUsers(usersWithBusinessIds);
        setBusinesses(businessesWithOwnerNames);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data from Firebase');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Resolve storage URLs with auth for selected business docs
  useEffect(() => {
    const resolveLinks = async () => {
      if (!selectedBusiness?.requiredDocuments?.length) {
        setDocLinks({});
        return;
      }

      const entries = await Promise.all(
        selectedBusiness.requiredDocuments.map(async (doc) => {
          const key = doc.type || doc.anchorId;
          if (!key) return null;

          const { rawPath } = getDocInfo(selectedBusiness, doc.type);
          const fallbackPath = doc.path || doc.documentPath || doc.fileUrl || doc.url;
          const targetPath = rawPath || fallbackPath;
          if (!targetPath) return null;

          try {
            const url = await getDownloadURL(ref(storage, targetPath));
            return [key, url] as const;
          } catch (err) {
            console.error('Failed to get download URL for', key, err);
            return null;
          }
        })
      );

      const map = Object.fromEntries(entries.filter(Boolean) as [string, string][]);
      setDocLinks(map);
    };

    resolveLinks();
  }, [selectedBusiness]);

  // Resolve storage URLs with auth for selected user docs
  useEffect(() => {
    const resolveUserLinks = async () => {
      if (!selectedUser?.requiredDocuments?.length) {
        setUserDocLinks({});
        return;
      }

      const entries = await Promise.all(
        selectedUser.requiredDocuments!.map(async (doc) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const key = (doc as any).type || (doc as any).anchorId;
          if (!key) return null;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const targetPath = (doc as any).storagePath;
          if (!targetPath) return null;

          try {
            const url = await getDownloadURL(ref(storage, targetPath));
            return [key, url] as const;
          } catch (err) {
            console.error('Failed to get download URL for user doc', key, err);
            return null;
          }
        })
      );

      const map = Object.fromEntries(entries.filter(Boolean) as [string, string][]);
      setUserDocLinks(map);
    };

    resolveUserLinks();
  }, [selectedUser]);

  // Fetch transactions for selected user
  useEffect(() => {
    const fetchUserTransactions = async () => {
      if (!selectedUser?.id) {
        setUserTransactions([]);
        setShowAllUserTransactions(false);
        return;
      }

      try {
        setLoadingTransactions(true);
        const txns = await getTransactionsByUser(selectedUser.id);
        const sorted = txns.sort((a, b) => {
          const dateA = a.date instanceof Date ? a.date : new Date(a.date || 0);
          const dateB = b.date instanceof Date ? b.date : new Date(b.date || 0);
          return dateB.getTime() - dateA.getTime();
        });
        setUserTransactions(sorted);
        setShowAllUserTransactions(false);
      } catch (err) {
        console.error('Failed to load user transactions:', err);
        setUserTransactions([]);
      } finally {
        setLoadingTransactions(false);
      }
    };

    fetchUserTransactions();
  }, [selectedUser?.id]);

  // Fetch transactions for selected business
  useEffect(() => {
    const fetchBusinessTransactions = async () => {
      if (!selectedBusiness?.id) {
        setBusinessTransactions([]);
        setShowAllBusinessTransactions(false);
        setSelectedBusinessTransaction(null);
        return;
      }

      try {
        setLoadingTransactions(true);
        const txns = await getTransactionsByUser(selectedBusiness.id);
        const sorted = txns
          .sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date : new Date(a.date || 0);
            const dateB = b.date instanceof Date ? b.date : new Date(b.date || 0);
            return dateB.getTime() - dateA.getTime();
          });
        setBusinessTransactions(sorted);
        setShowAllBusinessTransactions(false);
          setSelectedBusinessTransaction(null);
      } catch (err) {
        console.error('Failed to load business transactions:', err);
        setBusinessTransactions([]);
      } finally {
        setLoadingTransactions(false);
      }
    };

    fetchBusinessTransactions();
  }, [selectedBusiness?.id]);

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm);

    return matchesSearch;
  });

  const paginatedUsers = filteredUsers.slice(
    (usersCurrentPage - 1) * usersPageSize,
    usersCurrentPage * usersPageSize
  );
  const usersTotalPages = Math.ceil(filteredUsers.length / usersPageSize);

  const filteredBusinesses = businesses.filter((business) => {
    const bizName = business.business_data?.name?.toLowerCase() || '';
    const matchesSearch =
      bizName.includes(searchTerm.toLowerCase()) ||
      business.contact_data?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      business.contact_data?.phone?.includes(searchTerm) ||
      business.ownerName?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const paginatedBusinesses = filteredBusinesses.slice(
    (businessesCurrentPage - 1) * businessesPageSize,
    businessesCurrentPage * businessesPageSize
  );
  const businessesTotalPages = Math.ceil(filteredBusinesses.length / businessesPageSize);

  const getUserBusinesses = (userId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return businesses.filter((b) => (b as any).ownerId === userId || b.id === userId);
  };

  const getBusinessOwner = (ownerId: string) => {
    return users.find((u) => u.id === ownerId);
  };

  const displayedUserTransactions = showAllUserTransactions
    ? userTransactions
    : userTransactions.slice(0, 3);

  const displayedBusinessTransactions = showAllBusinessTransactions
    ? businessTransactions
    : businessTransactions.slice(0, 3);

  // Handler functions
  const handleDeleteUser = async (userId: string) => {
    setActionLoading(true);
    try {
      await deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
      setSelectedUser(null);
      setDeleteConfirm(null);
      showToast('success', 'User deleted', 'The user account has been permanently deleted.');
    } catch (error) {
      console.error('Error deleting user:', error);
      showToast('error', 'Delete failed', 'Failed to delete user account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFreezeAccount = async () => {
    if (!freezeReason.trim()) {
      showToast('error', 'Missing reason', 'Please provide a freeze reason.');
      return;
    }

    setActionLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountId = (selectedUser?.getAnchorData as any)?.virtualAccount?.data?.id;
      if (!accountId) {
        throw new Error('No virtual account found for this user');
      }

      await freezeAccount(accountId, freezeReason, freezeDescription);
      setFreezeConfirm(null);
      setFreezeReason('');
      setFreezeDescription('');
      showToast('success', 'Account frozen', `Account frozen for: ${freezeReason}`);
      
      // Optionally update user status in UI
      setSelectedUser(prev => prev ? { ...prev, status: 'suspended' } : null);
    } catch (error) {
      console.error('Error freezing account:', error);
      showToast('error', 'Freeze failed', 'Failed to freeze account. Check the accountId.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfreezeAccount = async () => {
    setActionLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const accountId = (selectedUser?.getAnchorData as any)?.virtualAccount?.data?.id;
      if (!accountId) {
        throw new Error('No virtual account found for this user');
      }

      await unFreezeAccount(accountId);
      showToast('success', 'Account unfrozen', 'Account has been unfrozen successfully.');
      
      // Update user status
      setSelectedUser(prev => prev ? { ...prev, status: 'active' } : null);
    } catch (error) {
      console.error('Error unfreezing account:', error);
      showToast('error', 'Unfreeze failed', 'Failed to unfreeze account.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleContactUser = async () => {
    if (!contactMessage.trim()) {
      showToast('error', 'Empty message', 'Please enter a message.');
      return;
    }

    if (!contactModal) return;

    setActionLoading(true);
    try {
      await contactUser(contactModal.userId, contactMessage, contactChannel);
      setContactModal(null);
      setContactMessage('');
      setContactChannel('email');
      showToast('success', 'Message sent', `Contact request sent via ${contactChannel}.`);
    } catch (error) {
      console.error('Error contacting user:', error);
      showToast('error', 'Send failed', 'Failed to send contact message.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = async () => {
    if (!editModal) return;

    setActionLoading(true);
    try {
      const updates = {
        firstName: editFormData.firstName || '',
        lastName: editFormData.lastName || '',
        email: editFormData.email || '',
        phone: editFormData.phone || '',
      };
      
      await updateUserProfile(editModal.id, updates);
      
      // Update local state
      setUsers(users.map(u => u.id === editModal.id ? { ...u, ...updates } : u));
      setSelectedUser(prev => prev?.id === editModal.id ? { ...prev, ...updates } : prev);
      
      setEditModal(null);
      setEditFormData({});
      showToast('success', 'Profile updated', 'User profile has been updated successfully.');
    } catch (error) {
      console.error('Error updating user:', error);
      showToast('error', 'Update failed', 'Failed to update user profile.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Users & Businesses</h1>
        <p className="text-gray-500 mt-1">Manage all registered users and businesses</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex gap-8">
              <button
                onClick={() => {
                  setActiveTab('users');
                  setSearchTerm('');
                }}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  Users ({users.length})
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab('businesses');
                  setSearchTerm('');
                }}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'businesses'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Businesses ({businesses.length})
                </div>
              </button>
            </div>
          </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'users' ? 'users' : 'businesses'} by name, email, or phone...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Users Table */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    KYC Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    KYC Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member Since
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Businesses
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {user.firstName?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.address?.city}, {user.address?.state}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        Tier {String(((user.getAnchorData as any)?.tier) || 'N/A')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          getKYCStatus(user)
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {getKYCStatus(user) ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.businessIds?.length || 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Users Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700">
                Rows per page:
                <select
                  value={usersPageSize}
                  onChange={(e) => {
                    setUsersPageSize(Number(e.target.value));
                    setUsersCurrentPage(1);
                  }}
                  className="ml-2 px-3 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </label>
              <span className="text-sm text-gray-600">
                Showing {Math.min((usersCurrentPage - 1) * usersPageSize + 1, filteredUsers.length)}-{Math.min(usersCurrentPage * usersPageSize, filteredUsers.length)} of {filteredUsers.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUsersCurrentPage(Math.max(1, usersCurrentPage - 1))}
                disabled={usersCurrentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, usersTotalPages) }, (_, i) => {
                  let pageNum;
                  if (usersTotalPages <= 5) {
                    pageNum = i + 1;
                  } else if (usersCurrentPage <= 3) {
                    pageNum = i + 1;
                  } else if (usersCurrentPage >= usersTotalPages - 2) {
                    pageNum = usersTotalPages - 4 + i;
                  } else {
                    pageNum = usersCurrentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setUsersCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        usersCurrentPage === pageNum
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setUsersCurrentPage(Math.min(usersTotalPages, usersCurrentPage + 1))}
                disabled={usersCurrentPage === usersTotalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Businesses Table */}
      {activeTab === 'businesses' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    KYC Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedBusinesses.map((business) => (
                  <tr
                    key={business.id}
                    onClick={() => setSelectedBusiness(business)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {business.business_data?.name || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {business.ownerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {business.contact_data?.email || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {business.business_data?.industry || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {business.getAnchorData?.virtualAccount?.data?.attributes?.accountNumber || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (business as any).kycStatus === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(business as any).kycStatus || 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Businesses Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700">
                Rows per page:
                <select
                  value={businessesPageSize}
                  onChange={(e) => {
                    setBusinessesPageSize(Number(e.target.value));
                    setBusinessesCurrentPage(1);
                  }}
                  className="ml-2 px-3 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </label>
              <span className="text-sm text-gray-600">
                Showing {Math.min((businessesCurrentPage - 1) * businessesPageSize + 1, filteredBusinesses.length)}-{Math.min(businessesCurrentPage * businessesPageSize, filteredBusinesses.length)} of {filteredBusinesses.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBusinessesCurrentPage(Math.max(1, businessesCurrentPage - 1))}
                disabled={businessesCurrentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, businessesTotalPages) }, (_, i) => {
                  let pageNum;
                  if (businessesTotalPages <= 5) {
                    pageNum = i + 1;
                  } else if (businessesCurrentPage <= 3) {
                    pageNum = i + 1;
                  } else if (businessesCurrentPage >= businessesTotalPages - 2) {
                    pageNum = businessesTotalPages - 4 + i;
                  } else {
                    pageNum = businessesCurrentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setBusinessesCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        businessesCurrentPage === pageNum
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setBusinessesCurrentPage(Math.min(businessesTotalPages, businessesCurrentPage + 1))}
                disabled={businessesCurrentPage === businessesTotalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedUser(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">User ID: {selectedUser.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Action Buttons */}
                  <button
                    onClick={() => {
                      setEditModal(selectedUser);
                      setEditFormData({
                        firstName: selectedUser.firstName,
                        lastName: selectedUser.lastName,
                        email: selectedUser.email,
                        phone: selectedUser.phone,
                      });
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit user"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setContactModal({ userId: selectedUser.id })}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    title="Contact user"
                  >
                    <Mail className="w-5 h-5" />
                  </button>

                  {selectedUser.status === 'suspended' ? (
                    <button
                      onClick={handleUnfreezeAccount}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Unfreeze account"
                      disabled={actionLoading}
                    >
                      <Unlock className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setFreezeConfirm(selectedUser.id)}
                      className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Freeze account"
                    >
                      <Lock className="w-5 h-5" />
                    </button>
                  )}

                  <button
                    onClick={() => setDeleteConfirm(selectedUser.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete user"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Profile Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="text-gray-900">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Phone</label>
                      <p className="text-gray-900">{selectedUser.phone}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Date of Birth</label>
                      <p className="text-gray-900">{selectedUser.dateOfBirth || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Gender</label>
                      <p className="text-gray-900">{selectedUser.gender || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Address</label>
                      <p className="text-gray-900">
                        {selectedUser.address?.street}, {selectedUser.address?.city},{' '}
                        {selectedUser.address?.state}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Member Since</label>
                      <p className="text-gray-900">
                        {selectedUser.createdAt
                          ? new Date(selectedUser.createdAt).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* KYC Documents */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">KYC Information</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">BVN</p>
                          <p className="text-xs text-gray-500">
                            {selectedUser.bvn || 'Not provided'}
                          </p>
                        </div>
                      </div>
                      {selectedUser.bvn && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">NIN</p>
                          <p className="text-xs text-gray-500">
                            {selectedUser.nin || 'Not provided'}
                          </p>
                        </div>
                      </div>
                      {selectedUser.nin && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Required Documents */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Tier 3 Documents</h3>
                  <div className="space-y-3">
                    {selectedUser.requiredDocuments?.length ? (
                      selectedUser.requiredDocuments.map((doc, idx: number) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const docAny = doc as any;
                        return (
                          <div key={docAny.anchorId || idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3 flex-1">
                              <FileText className="w-5 h-5 text-gray-500" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {docAny.type?.replace(/_/g, ' ') || docAny.fileName || 'Document'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {docAny.description || 'No description'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                docAny.status === 'approved' 
                                  ? 'bg-green-100 text-green-800'
                                  : docAny.status === 'submitted'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {docAny.status || 'Pending'}
                              </span>
                              {userDocLinks[docAny.type || docAny.anchorId] && (
                                <a
                                  href={userDocLinks[docAny.type || docAny.anchorId]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  View
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No documents submitted
                      </p>
                    )}
                  </div>
                </div>

                {/* Account Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Banking Information</h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Account Name</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedUser.getAnchorData?.virtualAccount?.data?.attributes?.accountName || 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Account Number</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedUser.getAnchorData?.virtualAccount?.data?.attributes?.accountNumber || 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Bank</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedUser.getAnchorData?.virtualAccount?.data?.attributes?.bank?.name || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recent Transactions
                  </h3>
                  {userTransactions.length > 3 && (
                    <div className="flex justify-end mb-2">
                      <button
                        onClick={() => setShowAllUserTransactions(!showAllUserTransactions)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {showAllUserTransactions ? 'Show top 3' : 'See all'}
                      </button>
                    </div>
                  )}
                  {loadingTransactions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : userTransactions.length > 0 ? (
                    <div className="space-y-3">
                      {displayedUserTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          onClick={() => setSelectedUserTransaction(transaction)}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 capitalize">
                              {formatTransactionType(transaction.type)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {transaction.date
                                ? new Date(transaction.date).toLocaleDateString()
                                : 'N/A'}
                            </p>
                          </div>
                          <p
                            className={`text-sm font-semibold ${
                              transaction.amount && transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.amount && transaction.amount > 0 ? '+' : ''}
                            {formatAmount(Math.abs(transaction.amount || 0), transaction.currency as string)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">
                      No transactions found
                    </p>
                  )}
                </div>

                {/* Owned Businesses */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Owned Businesses ({getUserBusinesses(selectedUser.id).length})
                  </h3>
                  {getUserBusinesses(selectedUser.id).length > 0 ? (
                    <div className="space-y-3">
                      {getUserBusinesses(selectedUser.id).map((business) => (
                        <div
                          key={business.id}
                          onClick={() => {
                            setSelectedUser(null);
                            setSelectedBusiness(business);
                          }}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {business.business_data?.name}
                              </p>
                              <p className="text-xs text-gray-500">{business.business_data?.industry}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                (business as any).kycStatus === 'APPROVED'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              {(business as any).kycStatus || 'Pending'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">
                      No businesses registered
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Transaction Detail Modal */}
      {selectedUserTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedUserTransaction(null)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedUserTransaction.id}</p>
              </div>
              <button
                onClick={() => setSelectedUserTransaction(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-gray-500">Reference</label>
                  <p className="text-gray-900 font-medium">{selectedUserTransaction.reference}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Type</label>
                  <p className="text-gray-900 font-medium capitalize">{formatTransactionType(selectedUserTransaction.type)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Amount</label>
                  <p className="text-gray-900 font-medium text-lg">
                    {formatAmount(selectedUserTransaction.amount, (selectedUserTransaction as any).currency)}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Status</label>
                  <span
                    className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full mt-1 ${
                      selectedUserTransaction.status === 'success' || selectedUserTransaction.status === 'successful'
                        ? 'bg-green-100 text-green-800'
                        : selectedUserTransaction.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedUserTransaction.status}
                  </span>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Date</label>
                  <p className="text-gray-900 font-medium">
                    {selectedUserTransaction.date
                      ? new Date(selectedUserTransaction.date).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Description</label>
                  <p className="text-gray-900 font-medium">
                    {selectedUserTransaction.description || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Transaction Detail Modal */}
      {selectedBusinessTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedBusinessTransaction(null)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedBusinessTransaction.id}</p>
              </div>
              <button
                onClick={() => setSelectedBusinessTransaction(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-gray-500">Reference</label>
                  <p className="text-gray-900 font-medium">{selectedBusinessTransaction.reference}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Type</label>
                  <p className="text-gray-900 font-medium capitalize">{formatTransactionType(selectedBusinessTransaction.type)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Amount</label>
                  <p className="text-gray-900 font-medium text-lg">
                    {formatAmount(selectedBusinessTransaction.amount, (selectedBusinessTransaction as any).currency)}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Status</label>
                  <span
                    className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full mt-1 ${
                      selectedBusinessTransaction.status === 'success' || selectedBusinessTransaction.status === 'successful'
                        ? 'bg-green-100 text-green-800'
                        : selectedBusinessTransaction.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedBusinessTransaction.status}
                  </span>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Date</label>
                  <p className="text-gray-900 font-medium">
                    {selectedBusinessTransaction.date
                      ? new Date(selectedBusinessTransaction.date).toLocaleString()
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Description</label>
                  <p className="text-gray-900 font-medium">
                    {selectedBusinessTransaction.description || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Detail Modal */}
      {selectedBusiness && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedBusiness(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedBusiness.business_data?.name || 'Business'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Business ID: {selectedBusiness.id}</p>
                </div>
                <button
                  onClick={() => setSelectedBusiness(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Business Owner */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Owner</h3>
                  {getBusinessOwner(selectedBusiness.ownerId) && (
                    <div
                      onClick={() => {
                        const owner = getBusinessOwner(selectedBusiness.ownerId);
                        if (owner) {
                          setSelectedBusiness(null);
                          setSelectedUser(owner);
                        }
                      }}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-lg">
                          {selectedBusiness.ownerName?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {selectedBusiness.ownerName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {getBusinessOwner(selectedBusiness.ownerId)?.email}
                        </p>
                      </div>
                      <UserIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Business Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Business Information</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-500">Industry</label>
                      <p className="text-gray-900">{selectedBusiness.business_data?.industry || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="text-gray-900">{selectedBusiness.contact_data?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Phone</label>
                      <p className="text-gray-900">{selectedBusiness.contact_data?.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Address</label>
                      <p className="text-gray-900">
                        {selectedBusiness.contact_data?.address}, {selectedBusiness.contact_data?.city},{' '}
                        {selectedBusiness.contact_data?.state}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Description</label>
                      <p className="text-gray-900">{selectedBusiness.business_data?.desc || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Registration Date</label>
                      <p className="text-gray-900">
                        {selectedBusiness.business_data?.regDate || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Registration Documents */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Documents</h3>
                  <div className="space-y-3">
                    {/* Required documents with statuses */}
                    {selectedBusiness.requiredDocuments?.length ? (
                      selectedBusiness.requiredDocuments.map((doc) => {
                        const docLabel = doc.type || doc.name || 'Document';
                        const { number: docNumber, path: docLink } = getDocInfo(selectedBusiness, doc.type);
                        const fallbackLink = doc.path || doc.documentPath || doc.fileUrl || doc.url;
                        const finalLink = docLinks[doc.type || ''] || docLink || toStorageUrl(fallbackLink);
                        return (
                          <div key={doc.anchorId || doc.type || doc.path} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <FileText className="w-5 h-5 text-gray-500 mt-0.5" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">
                                    {finalLink ? (
                                      <a
                                        href={finalLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                      >
                                        {docLabel}
                                      </a>
                                    ) : (
                                      docLabel
                                    )}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {doc.description || 'No description provided'}
                                  </p>
                                  {docNumber && (
                                    <p className="text-xs text-gray-600 mt-1">Number: {docNumber}</p>
                                  )}
                                  {!docNumber && !finalLink && (
                                    <p className="text-xs text-gray-400 mt-1">Not provided</p>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  doc.status === 'approved'
                                    ? 'bg-green-100 text-green-800'
                                    : doc.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {doc.status || 'unknown'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-gray-500">No required documents listed</p>
                    )}
                  </div>
                </div>

                {/* Account Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Banking Information</h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Account Name</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedBusiness.getAnchorData?.virtualAccount?.data?.attributes?.accountName || 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Account Number</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedBusiness.getAnchorData?.virtualAccount?.data?.attributes?.accountNumber || 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Bank</p>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedBusiness.getAnchorData?.virtualAccount?.data?.attributes?.bank?.name || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recent Transactions
                  </h3>
                  {businessTransactions.length > 3 && (
                    <div className="flex justify-end mb-2">
                      <button
                        onClick={() => setShowAllBusinessTransactions(!showAllBusinessTransactions)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {showAllBusinessTransactions ? 'Show top 3' : 'See all'}
                      </button>
                    </div>
                  )}
                  {loadingTransactions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : businessTransactions.length > 0 ? (
                    <div className="space-y-3">
                      {displayedBusinessTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          onClick={() => setSelectedBusinessTransaction(transaction)}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 capitalize">
                              {formatTransactionType(transaction.type)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {transaction.date
                                ? new Date(transaction.date).toLocaleDateString()
                                : 'N/A'}
                            </p>
                          </div>
                          <p
                            className={`text-sm font-semibold ${
                              transaction.amount && transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.amount && transaction.amount > 0 ? '+' : ''}
                            {formatAmount(Math.abs(transaction.amount || 0), transaction.currency as string)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">
                      No transactions found
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        type="danger"
        title="Delete user account?"
        message="This will permanently delete the user account and all associated data. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={actionLoading}
        onConfirm={async () => {
          if (deleteConfirm) {
            await handleDeleteUser(deleteConfirm);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Freeze Account Modal */}
      {freezeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFreezeConfirm(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200 border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Freeze Account</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Freeze Reason *</label>
                <input
                  type="text"
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="e.g., Suspicious activity, Compliance review"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  value={freezeDescription}
                  onChange={(e) => setFreezeDescription(e.target.value)}
                  placeholder="Add more details..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setFreezeConfirm(null)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFreezeAccount}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Freezing...' : 'Freeze Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact User Modal */}
      {contactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/50" onClick={() => setContactModal(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200 border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact User</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channel</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setContactChannel('email')}
                    className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                      contactChannel === 'email'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email
                  </button>
                  <button
                    onClick={() => setContactChannel('sms')}
                    className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                      contactChannel === 'sms'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Phone className="w-4 h-4 inline mr-2" />
                    SMS
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setContactModal(null)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleContactUser}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditModal(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200 border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit User Profile</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  value={editFormData.firstName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  value={editFormData.lastName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={editFormData.phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setEditModal(null)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditUser}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
