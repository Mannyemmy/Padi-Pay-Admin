'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  X,
  Eye,
  FileText,
  User as UserIcon,
  Download,
  RefreshCw,
  AlertCircle,
  Shield,
  BarChart3,
  Loader,
  Building2
} from 'lucide-react';
import { getUsers, getBusinesses } from '@/lib/firestore';
import { showToast } from '@/components/Toast';
import { ExportMenu } from '@/components/ExportMenu';
import { User, Business } from '@/lib/types';
import { useDemoMode } from '@/lib/demo';

type VerificationStatus = 'verified' | 'pending' | 'failed' | 'not_submitted';
type VerificationType = 'bvn' | 'nin' | 'liveness' | 'business_registration' | 'unknown';

interface KYCMetrics {
  totalUsers: number;
  totalBusinesses: number;
  verifiedUsers: number;
  verifiedBusinesses: number;
  pendingVerifications: number;
  failedVerifications: number;
  averageSimilarityScore: number;
  verificationRate: number;
}

interface KYCUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  userType: 'individual' | 'business';
  verificationType: VerificationType;
  status: VerificationStatus;
  submittedAt: Date | null;
  completedAt: Date | null;
  similarityScore: number | null;
  imageUrl: string | null;
  bvn?: string;
  nin?: string;
  companyName?: string;
  businessId?: string;
  userId?: string;
  data: any; // Full qoreIdData
  metadata?: {
    match?: boolean;
    isLive?: boolean;
    percentageSimilarity?: number;
    type?: string;
    imageUrl?: string;
    matchingThreshold?: number;
  };
}

export default function CompliancePage() {
  const demoMode = useDemoMode();
  const mockOpts = demoMode ? { mock: true } : undefined;
  const [users, setUsers] = useState<User[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<VerificationType | 'all'>('all');
  const [selectedUser, setSelectedUser] = useState<KYCUser | null>(null);
  const [metrics, setMetrics] = useState<KYCMetrics>({
    totalUsers: 0,
    totalBusinesses: 0,
    verifiedUsers: 0,
    verifiedBusinesses: 0,
    pendingVerifications: 0,
    failedVerifications: 0,
    averageSimilarityScore: 0,
    verificationRate: 0
  });
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Fetch all users and businesses
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersData, businessesData] = await Promise.all([
          getUsers(mockOpts),
          getBusinesses(mockOpts),
        ]);
        setUsers(usersData);
        setBusinesses(businessesData);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load compliance data');
        showToast('error', 'Load Failed', 'Failed to load compliance data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Process KYC data and calculate metrics
  useEffect(() => {
    if (users.length === 0 && businesses.length === 0) return;

    const kycUsers = processKYCData();
    calculateMetrics(kycUsers);
  }, [users, businesses]);

  const getVerificationStatus = (qoreIdData: any): {
    status: VerificationStatus;
    metadata?: any;
    similarityScore: number | null;
    imageUrl: string | null;
    verificationType: VerificationType;
  } => {
    if (!qoreIdData?.verification) {
      return {
        status: 'not_submitted',
        similarityScore: null,
        imageUrl: null,
        verificationType: 'unknown'
      };
    }

    const verification = qoreIdData.verification;
    const metadata = verification.metadata;
    
    if (!metadata) {
      return {
        status: 'pending',
        metadata,
        similarityScore: null,
        imageUrl: null,
        verificationType: 'unknown'
      };
    }

    // Determine verification type
    let verificationType: VerificationType = 'unknown';
    if (metadata.type === 'bvn') verificationType = 'bvn';
    else if (metadata.type === 'nin') verificationType = 'nin';
    else if (metadata.productCode === 'liveness_bvn') verificationType = 'liveness';
    else if (metadata.type === 'business_registration') verificationType = 'business_registration';

    // Determine status based on metadata.match
    let status: VerificationStatus = 'pending';
    
    if (metadata.match === true) {
      status = 'verified';
    } else if (metadata.match === false) {
      status = 'failed';
    } else if (verification.state === 'complete' && metadata.match === undefined) {
      // If state is complete but no match field, check if there's a similarity score
      if (metadata.percentageSimilarity) {
        status = metadata.percentageSimilarity >= 80 ? 'verified' : 'failed';
      }
    }

    return {
      status,
      metadata,
      similarityScore: metadata.percentageSimilarity || null,
      imageUrl: metadata.imageUrl || null,
      verificationType
    };
  };

  const processKYCData = (): KYCUser[] => {
    const kycUsers: KYCUser[] = [];

    // Process individual users
    users.forEach(user => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qoreIdData = (user as any).qoreIdData as any;
      
      const {
        status,
        metadata,
        similarityScore,
        imageUrl,
        verificationType
      } = getVerificationStatus(qoreIdData);

      let submittedAt: Date | null = null;
      let completedAt: Date | null = null;

      // Try to extract timestamps from various possible fields
      if (qoreIdData?.verification) {
        const verification = qoreIdData.verification;
        
        // Check for submitted date
        if (verification.submitted) {
          submittedAt = new Date();
        }
        
        // Check for completed date
        if (verification.state === 'complete') {
          completedAt = new Date();
        }
        
        // Check metadata for timestamps
        if (metadata?.createdAt) {
          completedAt = new Date(metadata.createdAt);
        }
      }

      kycUsers.push({
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown User',
        email: user.email || '',
        phone: user.phone || '',
        userType: 'individual',
        verificationType,
        status,
        submittedAt,
        completedAt,
        similarityScore,
        imageUrl,
        bvn: user.bvn,
        nin: user.nin,
        userId: user.id,
        data: qoreIdData,
        metadata
      });
    });

    // Process businesses
    businesses.forEach(business => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qoreIdData = (business as any).qoreIdData as any;
      
      const {
        status,
        metadata,
        similarityScore,
        imageUrl,
        verificationType
      } = getVerificationStatus(qoreIdData);

      let submittedAt: Date | null = null;
      let completedAt: Date | null = null;

      if (qoreIdData?.verification) {
        const verification = qoreIdData.verification;
        
        if (verification.submitted) {
          submittedAt = new Date();
        }
        
        if (verification.state === 'complete') {
          completedAt = new Date();
        }
        
        if (metadata?.createdAt) {
          completedAt = new Date(metadata.createdAt);
        }
      }

      kycUsers.push({
        id: business.id,
        name: business.business_data?.name || 'Unknown Business',
        email: business.contact_data?.email || '',
        phone: business.contact_data?.phone || '',
        userType: 'business',
        verificationType,
        status,
        submittedAt,
        completedAt,
        similarityScore,
        imageUrl,
        companyName: business.business_data?.name,
        businessId: business.id,
        data: qoreIdData,
        metadata
      });
    });

    return kycUsers;
  };

  const calculateMetrics = (kycUsers: KYCUser[]) => {
    const totalUsers = users.length;
    const totalBusinesses = businesses.length;
    
    const verifiedUsers = kycUsers.filter(u => 
      u.userType === 'individual' && u.status === 'verified'
    ).length;
    
    const verifiedBusinesses = kycUsers.filter(u => 
      u.userType === 'business' && u.status === 'verified'
    ).length;
    
    const pendingVerifications = kycUsers.filter(u => 
      u.status === 'pending'
    ).length;
    
    const failedVerifications = kycUsers.filter(u => 
      u.status === 'failed'
    ).length;
    
    const verifiedUsersWithScore = kycUsers.filter(u => 
      u.status === 'verified' && u.similarityScore
    );
    
    const averageSimilarityScore = verifiedUsersWithScore.length > 0
      ? verifiedUsersWithScore.reduce((sum, u) => sum + (u.similarityScore || 0), 0) / verifiedUsersWithScore.length
      : 0;

    const totalEntities = totalUsers + totalBusinesses;
    const totalVerified = verifiedUsers + verifiedBusinesses;
    const verificationRate = totalEntities > 0 ? (totalVerified / totalEntities) * 100 : 0;

    setMetrics({
      totalUsers,
      totalBusinesses,
      verifiedUsers,
      verifiedBusinesses,
      pendingVerifications,
      failedVerifications,
      averageSimilarityScore,
      verificationRate
    });
  };

  const kycUsers = useMemo(() => processKYCData(), [users, businesses]);

  const filteredKYCUsers = useMemo(() => {
    return kycUsers.filter(user => {
      // Search filter
      const matchesSearch = 
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone.includes(searchTerm) ||
        (user.bvn && user.bvn.includes(searchTerm)) ||
        (user.nin && user.nin.includes(searchTerm)) ||
        (user.companyName && user.companyName.toLowerCase().includes(searchTerm.toLowerCase()));

      // Status filter
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      
      // Type filter
      const matchesType = typeFilter === 'all' || user.verificationType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [kycUsers, searchTerm, statusFilter, typeFilter]);

  const paginatedKYCUsers = filteredKYCUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredKYCUsers.length / pageSize);

  const handleRefresh = async () => {
    setRefreshLoading(true);
    try {
      const [usersData, businessesData] = await Promise.all([
        getUsers(),
        getBusinesses(),
      ]);
      setUsers(usersData);
      setBusinesses(businessesData);
      showToast('success', 'Refreshed', 'KYC data has been refreshed');
    } catch (err) {
      console.error('Error refreshing data:', err);
      showToast('error', 'Refresh Failed', 'Failed to refresh KYC data');
    } finally {
      setRefreshLoading(false);
    }
  };

  const getStatusColor = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'not_submitted':
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'not_submitted':
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: VerificationType) => {
    switch (type) {
      case 'bvn':
        return <FileText className="w-4 h-4" />;
      case 'nin':
        return <FileText className="w-4 h-4" />;
      case 'liveness':
        return <UserIcon className="w-4 h-4" />;
      case 'business_registration':
        return <Shield className="w-4 h-4" />;
      case 'unknown':
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const exportData = kycUsers.map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    userType: user.userType,
    verificationType: user.verificationType,
    status: user.status,
    similarityScore: user.similarityScore,
    submittedAt: user.submittedAt?.toISOString() || '',
    completedAt: user.completedAt?.toISOString() || '',
    bvn: user.bvn || '',
    nin: user.nin || '',
    companyName: user.companyName || '',
    metadataMatch: user.metadata?.match || false,
    metadataIsLive: user.metadata?.isLive || false,
    metadataType: user.metadata?.type || '',
    imageUrl: user.imageUrl || ''
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Compliance & KYC
            </h1>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
              Monitor and manage KYC verifications
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshLoading ? 'animate-spin' : ''}`} />
              {refreshLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <ExportMenu
              data={exportData}
              filenameBase="kyc-verifications"
              title="KYC Verifications Export"
              renderPrint={(data) => {
                const rows = data.map((r: any) => `
                  <tr>
                    <td>${r.id.startsWith('mock_') ? '—' : r.id}</td>
                    <td>${r.name}</td>
                    <td>${r.email}</td>
                    <td>${r.phone}</td>
                    <td>${r.userType}</td>
                    <td>${r.verificationType}</td>
                    <td>${r.status}</td>
                    <td>${r.similarityScore || 'N/A'}</td>
                    <td>${r.metadataMatch ? 'Yes' : 'No'}</td>
                    <td>${r.submittedAt ? new Date(r.submittedAt).toLocaleString() : 'N/A'}</td>
                  </tr>
                `).join('');
                return `
                  <h1>KYC Verifications</h1>
                  <table border="1" cellpadding="6" cellspacing="0">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>User Type</th>
                        <th>Verification Type</th>
                        <th>Status</th>
                        <th>Similarity Score</th>
                        <th>Metadata Match</th>
                        <th>Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                  </table>
                `;
              }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalUsers}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Verified: {metrics.verifiedUsers} ({metrics.totalUsers > 0 ? Math.round((metrics.verifiedUsers / metrics.totalUsers) * 100) : 0}%)
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Businesses</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalBusinesses}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Verified: {metrics.verifiedBusinesses} ({metrics.totalBusinesses > 0 ? Math.round((metrics.verifiedBusinesses / metrics.totalBusinesses) * 100) : 0}%)
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Verification Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.verificationRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Overall verification success rate
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg. Similarity Score</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.averageSimilarityScore.toFixed(1)}%
              </p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Average score for verified users
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-800 font-medium">Pending Verifications</p>
              <p className="text-2xl font-bold text-yellow-900 mt-1">{metrics.pendingVerifications}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-800 font-medium">Failed Verifications</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{metrics.failedVerifications}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-800 font-medium">Not Submitted</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {kycUsers.filter(u => u.status === 'not_submitted').length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, phone, BVN, NIN, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as VerificationStatus | 'all')}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="not_submitted">Not Submitted</option>
              </select>
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as VerificationType | 'all')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="bvn">BVN</option>
              <option value="nin">NIN</option>
              <option value="liveness">Liveness</option>
              <option value="business_registration">Business Registration</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
      </div>

      {/* KYC Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User/Business
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verification
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Metadata Match
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Similarity Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                    <p className="text-gray-500 mt-2">Loading KYC data...</p>
                  </td>
                </tr>
              ) : paginatedKYCUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-gray-400">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                      <p>No KYC verifications found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedKYCUsers.map((user) => (
                  <tr
                    key={`${user.userType}-${user.id}`}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          user.userType === 'individual' ? 'bg-blue-100' : 'bg-purple-100'
                        }`}>
                          {user.userType === 'individual' ? (
                            <UserIcon className={`w-5 h-5 ${user.userType === 'individual' ? 'text-blue-600' : 'text-purple-600'}`} />
                          ) : (
                            <Building2 className="w-5 h-5 text-purple-600" />
                          )}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {user.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {user.email}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {!user.id.startsWith('mock_') && `ID: ${user.id}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        user.userType === 'individual' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {user.userType === 'individual' ? 'Individual' : 'Business'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(user.verificationType)}
                        <span className="text-sm text-gray-900 capitalize">
                          {user.verificationType.replace('_', ' ')}
                        </span>
                      </div>
                      {(user.bvn || user.nin) && (
                        <div className="text-xs text-gray-500 mt-1">
                          {user.bvn ? `BVN: ${user.bvn}` : user.nin ? `NIN: ${user.nin}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(user.status)}`}>
                        {getStatusIcon(user.status)}
                        {user.status === 'not_submitted' ? 'Not Submitted' : user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.metadata?.match !== undefined ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                          user.metadata.match
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.metadata.match ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              Match
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              No Match
                            </>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">N/A</span>
                      )}
                      {user.metadata?.isLive !== undefined && (
                        <div className="text-xs text-gray-500 mt-1">
                          Liveness: {user.metadata.isLive ? 'Live' : 'Not Live'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.similarityScore ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-full rounded-full ${
                                user.similarityScore >= 95 ? 'bg-green-600' :
                                user.similarityScore >= 80 ? 'bg-yellow-600' :
                                'bg-red-600'
                              }`}
                              style={{ width: `${Math.min(user.similarityScore, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {user.similarityScore.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && paginatedKYCUsers.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700">
                Rows per page:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="ml-2 px-3 py-1 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </label>
              <span className="text-sm text-gray-600">
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredKYCUsers.length)}-
                {Math.min(currentPage * pageSize, filteredKYCUsers.length)} of {filteredKYCUsers.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        currentPage === pageNum
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
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KYC Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedUser(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    KYC Verification Details
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedUser.userType === 'individual' ? 'User' : 'Business'}{!selectedUser.id.startsWith('mock_') && ` ID: ${selectedUser.id}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* User Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {selectedUser.userType === 'individual' ? 'User' : 'Business'} Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Name</label>
                      <p className="text-gray-900 font-medium">{selectedUser.name}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="text-gray-900 font-medium">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Phone</label>
                      <p className="text-gray-900 font-medium">{selectedUser.phone}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">User Type</label>
                      <p className="text-gray-900 font-medium capitalize">{selectedUser.userType}</p>
                    </div>
                    {selectedUser.bvn && (
                      <div>
                        <label className="text-sm text-gray-500">BVN</label>
                        <p className="text-gray-900 font-medium">{selectedUser.bvn}</p>
                      </div>
                    )}
                    {selectedUser.nin && (
                      <div>
                        <label className="text-sm text-gray-500">NIN</label>
                        <p className="text-gray-900 font-medium">{selectedUser.nin}</p>
                      </div>
                    )}
                    {selectedUser.companyName && (
                      <div>
                        <label className="text-sm text-gray-500">Company Name</label>
                        <p className="text-gray-900 font-medium">{selectedUser.companyName}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Status */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Status</h3>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Status</label>
                        <div className="mt-1">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full border ${getStatusColor(selectedUser.status)}`}>
                            {getStatusIcon(selectedUser.status)}
                            {selectedUser.status === 'not_submitted' ? 'Not Submitted' : selectedUser.status}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Verification Type</label>
                        <div className="flex items-center gap-2 mt-1">
                          {getTypeIcon(selectedUser.verificationType)}
                          <span className="text-gray-900 font-medium capitalize">
                            {selectedUser.verificationType.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Similarity Score</label>
                        <p className="text-gray-900 font-medium">
                          {selectedUser.similarityScore ? `${selectedUser.similarityScore.toFixed(1)}%` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Submitted</label>
                        <p className="text-gray-900 font-medium">{formatDate(selectedUser.submittedAt)}</p>
                      </div>
                    </div>

                    {/* Metadata Details */}
                    {selectedUser.metadata && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Metadata Details</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-xs text-gray-500">Match:</span>
                            <span className={`ml-2 text-xs font-medium ${selectedUser.metadata.match ? 'text-green-600' : 'text-red-600'}`}>
                              {selectedUser.metadata.match !== undefined ? (selectedUser.metadata.match ? 'Yes' : 'No') : 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">Is Live:</span>
                            <span className={`ml-2 text-xs font-medium ${selectedUser.metadata.isLive ? 'text-green-600' : 'text-red-600'}`}>
                              {selectedUser.metadata.isLive !== undefined ? (selectedUser.metadata.isLive ? 'Yes' : 'No') : 'N/A'}
                            </span>
                          </div>
                          {selectedUser.metadata.type && (
                            <div>
                              <span className="text-xs text-gray-500">Type:</span>
                              <span className="ml-2 text-xs font-medium">{selectedUser.metadata.type}</span>
                            </div>
                          )}
                          {selectedUser.metadata.matchingThreshold && (
                            <div>
                              <span className="text-xs text-gray-500">Threshold:</span>
                              <span className="ml-2 text-xs font-medium">{selectedUser.metadata.matchingThreshold}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Image */}
                {selectedUser.imageUrl && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification Image</h3>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <img
                        src={selectedUser.imageUrl}
                        alt="Verification"
                        className="max-w-full h-auto max-h-96 object-contain rounded-lg mx-auto"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Available';
                        }}
                      />
                      <div className="mt-4 text-center">
                        <a
                          href={selectedUser.imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          Open Full Image
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Raw Verification Data */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Raw Verification Data</h3>
                  <div className="p-4 bg-gray-900 rounded-lg">
                    <pre className="text-sm text-gray-300 overflow-auto max-h-96">
                      {JSON.stringify(selectedUser.data || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}