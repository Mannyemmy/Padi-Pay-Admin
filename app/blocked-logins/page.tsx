'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  X,
  Eye,
  RefreshCw,
  AlertCircle,
  Loader,
  User,
  Unlock,
  Lock,
  ShieldAlert,
  History,
  AlertTriangle,
  Ban,
  Users,
  Building2
} from 'lucide-react';
import { collection, getDocs, query, orderBy, Timestamp, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { showToast } from '@/components/Toast';
import { ExportMenu } from '@/components/ExportMenu';
import { formatDistanceToNow } from 'date-fns';

type BlockStatus = 'active' | 'expired' | 'manual';
type AppType = 'business' | 'user' | 'all';

interface BlockedLogin {
  id: string;
  email: string;
  failedAttempts: number;
  firstFailedAt: Timestamp;
  lastFailedAt: Timestamp;
  blockedUntil: Timestamp;
  appType: AppType;
  isActive: boolean;
  ipAddress?: string;
  location?: {
    city: string;
    country: string;
    region: string;
    org: string;
  };
  manuallyUnblocked?: boolean;
  unblockedAt?: Timestamp;
  unblockedBy?: string;
  userId?: string;
  businessId?: string;
}

interface BlockMetrics {
  totalBlocked: number;
  activeBlocks: number;
  expiredBlocks: number;
  uniqueUsers: number;
  uniqueBusinesses: number;
  todayBlocks: number;
  thisWeekBlocks: number;
  averageBlockDuration: number;
  topBlockedDomains: Array<{domain: string, count: number}>;
}

export default function BlockedLoginsPage() {
  const [blockedLogins, setBlockedLogins] = useState<BlockedLogin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BlockStatus | 'all'>('all');
  const [appTypeFilter, setAppTypeFilter] = useState<AppType>('all');
  const [selectedBlock, setSelectedBlock] = useState<BlockedLogin | null>(null);
  const [unblockLoading, setUnblockLoading] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<BlockMetrics>({
    totalBlocked: 0,
    activeBlocks: 0,
    expiredBlocks: 0,
    uniqueUsers: 0,
    uniqueBusinesses: 0,
    todayBlocks: 0,
    thisWeekBlocks: 0,
    averageBlockDuration: 0,
    topBlockedDomains: []
  });
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });
  const [showUnblockConfirm, setShowUnblockConfirm] = useState(false);
  const [blockToUnblock, setBlockToUnblock] = useState<string | null>(null);

  // Fetch blocked logins
  useEffect(() => {
    fetchBlockedLogins();
  }, []);

  const fetchBlockedLogins = async () => {
    try {
      setLoading(true);
      const logsRef = collection(db, 'blockedLogins');
      const q = query(logsRef, orderBy('lastFailedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const logs: BlockedLogin[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const now = new Date();
        const blockedUntil = data.blockedUntil?.toDate();
        const isActive = blockedUntil ? now < blockedUntil : true;
        
        logs.push({
          id: doc.id,
          email: data.email || 'Unknown',
          failedAttempts: data.failedAttempts || 0,
          firstFailedAt: data.firstFailedAt || Timestamp.now(),
          lastFailedAt: data.lastFailedAt || Timestamp.now(),
          blockedUntil: data.blockedUntil || Timestamp.now(),
          appType: data.appType || 'user',
          isActive,
          ipAddress: data.ipAddress,
          location: data.location,
          manuallyUnblocked: data.manuallyUnblocked || false,
          unblockedAt: data.unblockedAt,
          unblockedBy: data.unblockedBy,
          userId: data.userId,
          businessId: data.businessId
        });
      });
      
      setBlockedLogins(logs);
      setError(null);
    } catch (err) {
      console.error('Error fetching blocked logins:', err);
      setError('Failed to load blocked logins');
      showToast('error', 'Load Failed', 'Failed to load blocked logins data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  useEffect(() => {
    if (blockedLogins.length === 0) return;

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const activeBlocks = blockedLogins.filter(log => log.isActive).length;
    const expiredBlocks = blockedLogins.filter(log => !log.isActive).length;
    
    const uniqueEmails = new Set(blockedLogins.map(log => log.email)).size;
    const userBlocks = blockedLogins.filter(log => log.appType === 'user');
    const businessBlocks = blockedLogins.filter(log => log.appType === 'business');
    
    const todayBlocks = blockedLogins.filter(log => 
      log.lastFailedAt.toDate() >= today
    ).length;
    
    const thisWeekBlocks = blockedLogins.filter(log => 
      log.lastFailedAt.toDate() >= weekAgo
    ).length;

    // Calculate average block duration (in hours)
    const activeDurations = blockedLogins
      .filter(log => log.isActive)
      .map(log => {
        const blockedUntil = log.blockedUntil.toDate();
        const lastFailed = log.lastFailedAt.toDate();
        return (blockedUntil.getTime() - lastFailed.getTime()) / (1000 * 60 * 60);
      });
    
    const averageBlockDuration = activeDurations.length > 0
      ? activeDurations.reduce((a, b) => a + b, 0) / activeDurations.length
      : 0;

    // Get top blocked domains
    const domainCounts: { [domain: string]: number } = {};
    blockedLogins.forEach(log => {
      const domain = log.email.split('@')[1];
      if (domain) {
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      }
    });
    
    const topBlockedDomains = Object.entries(domainCounts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setMetrics({
      totalBlocked: blockedLogins.length,
      activeBlocks,
      expiredBlocks,
      uniqueUsers: userBlocks.length,
      uniqueBusinesses: businessBlocks.length,
      todayBlocks,
      thisWeekBlocks,
      averageBlockDuration: Math.round(averageBlockDuration * 10) / 10,
      topBlockedDomains
    });
  }, [blockedLogins]);

  const filteredLogins = useMemo(() => {
    return blockedLogins.filter(log => {
      // Search filter
      const matchesSearch = 
        log.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.ipAddress && log.ipAddress.includes(searchTerm)) ||
        (log.location?.city && log.location.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.location?.country && log.location.country.toLowerCase().includes(searchTerm.toLowerCase()));

      // Status filter
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'active' ? log.isActive : 
         statusFilter === 'expired' ? !log.isActive && !log.manuallyUnblocked :
         log.manuallyUnblocked);
      
      // App type filter
      const matchesAppType = appTypeFilter === 'all' || log.appType === appTypeFilter;
      
      // Date range filter
      const logDate = log.lastFailedAt.toDate();
      const matchesDate = (!dateRange.start || logDate >= dateRange.start) && 
                         (!dateRange.end || logDate <= dateRange.end);

      return matchesSearch && matchesStatus && matchesAppType && matchesDate;
    });
  }, [blockedLogins, searchTerm, statusFilter, appTypeFilter, dateRange]);

  const paginatedLogins = filteredLogins.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredLogins.length / pageSize);

  const handleRefresh = async () => {
    setRefreshLoading(true);
    try {
      await fetchBlockedLogins();
      showToast('success', 'Refreshed', 'Blocked logins data has been refreshed');
    } catch (err) {
      console.error('Error refreshing data:', err);
      showToast('error', 'Refresh Failed', 'Failed to refresh blocked logins');
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleUnblock = async (blockId: string, email: string) => {
    if (!blockId) return;
    
    setUnblockLoading(blockId);
    try {
      const blockRef = doc(db, 'blockedLogins', blockId);
      
      await updateDoc(blockRef, {
        manuallyUnblocked: true,
        unblockedAt: Timestamp.now(),
        unblockedBy: 'admin', // In real app, use current admin user ID
        isActive: false,
        blockedUntil: Timestamp.now() // Set to now to expire immediately
      });

      // Log the unblock action
      await logUnblockAction(blockId, email);
      
      // Refresh the data
      await fetchBlockedLogins();
      
      showToast('success', 'Unblocked', `Email ${email} has been unblocked`);
      setShowUnblockConfirm(false);
      setBlockToUnblock(null);
    } catch (err) {
      console.error('Error unblocking:', err);
      showToast('error', 'Unblock Failed', 'Failed to unblock the email');
    } finally {
      setUnblockLoading(null);
    }
  };

 
const logUnblockAction = async (blockId: string, email: string) => {
  try {
    await addDoc(collection(db, 'securityEvents'), {
      type: 'manual_unblock',
      email,
      blockId,
      action: 'admin_unblock',
      timestamp: Timestamp.now(),
      performedBy: 'admin', // ideally current admin uid
      note: 'Manually unblocked by administrator'
    });
  } catch (err) {
    console.error('Error logging unblock action:', err);
  }
};
  const handleDeleteExpired = async () => {
    try {
      const expiredLogins = blockedLogins.filter(log => !log.isActive);
      
      const deletePromises = expiredLogins.map(async (log) => {
        const blockRef = doc(db, 'blockedLogins', log.id);
        return deleteDoc(blockRef);
      });

      await Promise.all(deletePromises);
      await fetchBlockedLogins();
      
      showToast('success', 'Cleaned Up', 'Expired blocked logins have been removed');
    } catch (err) {
      console.error('Error deleting expired:', err);
      showToast('error', 'Cleanup Failed', 'Failed to remove expired blocks');
    }
  };

  const getStatusColor = (block: BlockedLogin) => {
    if (block.manuallyUnblocked) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    return block.isActive 
      ? 'bg-red-100 text-red-800 border-red-200' 
      : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (block: BlockedLogin) => {
    if (block.manuallyUnblocked) {
      return <Unlock className="w-4 h-4" />;
    }
    return block.isActive 
      ? <Lock className="w-4 h-4" /> 
      : <Clock className="w-4 h-4" />;
  };

  const getStatusText = (block: BlockedLogin) => {
    if (block.manuallyUnblocked) {
      return 'Manually Unblocked';
    }
    return block.isActive ? 'Active' : 'Expired';
  };

  const getAppTypeIcon = (appType: AppType) => {
    switch (appType) {
      case 'business':
        return <Building2 className="w-4 h-4" />;
      case 'user':
        return <User className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate();
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeRemaining = (blockedUntil: Timestamp) => {
    const now = new Date();
    const blockedDate = blockedUntil.toDate();
    
    if (now >= blockedDate) return 'Expired';
    
    const diffMs = blockedDate.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  const exportData = filteredLogins.map(log => ({
    id: log.id,
    email: log.email,
    failedAttempts: log.failedAttempts,
    firstFailedAt: log.firstFailedAt.toDate().toISOString(),
    lastFailedAt: log.lastFailedAt.toDate().toISOString(),
    blockedUntil: log.blockedUntil.toDate().toISOString(),
    appType: log.appType,
    status: getStatusText(log),
    isActive: log.isActive,
    ipAddress: log.ipAddress || '',
    city: log.location?.city || '',
    country: log.location?.country || '',
    region: log.location?.region || '',
    org: log.location?.org || '',
    manuallyUnblocked: log.manuallyUnblocked || false,
    unblockedAt: log.unblockedAt?.toDate().toISOString() || '',
    unblockedBy: log.unblockedBy || '',
    timeRemaining: formatTimeRemaining(log.blockedUntil)
  }));

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setAppTypeFilter('all');
    setDateRange({ start: null, end: null });
  };

  const confirmUnblock = (blockId: string) => {
    setBlockToUnblock(blockId);
    setShowUnblockConfirm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Blocked Logins Management
            </h1>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
              Monitor and manage temporarily blocked login attempts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 text-white"
            >
              <RefreshCw className={`w-4 h-4 ${refreshLoading ? 'animate-spin' : ''}`} />
              {refreshLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={handleDeleteExpired}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg flex items-center gap-2 transition-colors text-white"
              title="Remove expired blocked logins"
            >
              <X className="w-4 h-4" />
              Clean Expired
            </button>
            <ExportMenu
              data={exportData}
              filenameBase="blocked-logins"
              title="Blocked Logins Export"
              renderPrint={(data) => {
                const rows = data.map((r: any) => `
                  <tr>
                    <td>${r.email}</td>
                    <td>${r.failedAttempts}</td>
                    <td>${r.appType}</td>
                    <td>${r.status}</td>
                    <td>${r.lastFailedAt ? new Date(r.lastFailedAt).toLocaleString() : 'N/A'}</td>
                    <td>${r.blockedUntil ? new Date(r.blockedUntil).toLocaleString() : 'N/A'}</td>
                    <td>${r.timeRemaining}</td>
                    <td>${r.ipAddress || 'N/A'}</td>
                  </tr>
                `).join('');
                return `
                  <h1>Blocked Logins Report</h1>
                  <table border="1" cellpadding="6" cellspacing="0">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Failed Attempts</th>
                        <th>App Type</th>
                        <th>Status</th>
                        <th>Last Failed</th>
                        <th>Blocked Until</th>
                        <th>Time Remaining</th>
                        <th>IP Address</th>
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
              <p className="text-sm text-gray-500">Total Blocked</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalBlocked}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Active: {metrics.activeBlocks}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Blocks</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.activeBlocks}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Lock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Today: {metrics.todayBlocks}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg. Block Duration</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.averageBlockDuration}h</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Standard 1-hour blocks
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">This Week</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.thisWeekBlocks}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <History className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            New blocked accounts
          </div>
        </div>
      </div>

      {/* App Type Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-800 font-medium">Business Accounts</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{metrics.uniqueBusinesses}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <div className="mt-2 text-xs text-blue-700">
            {blockedLogins.filter(l => l.appType === 'business' && l.isActive).length} active blocks
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-800 font-medium">User Accounts</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{metrics.uniqueUsers}</p>
            </div>
            <Users className="w-8 h-8 text-green-600" />
          </div>
          <div className="mt-2 text-xs text-green-700">
            {blockedLogins.filter(l => l.appType === 'user' && l.isActive).length} active blocks
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-800 font-medium">Expired Blocks</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.expiredBlocks}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-600" />
          </div>
          <div className="mt-2 text-xs text-gray-700">
            Ready for cleanup
          </div>
        </div>
      </div>

      {/* Top Blocked Domains */}
      {metrics.topBlockedDomains.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Top Blocked Domains</h3>
          <div className="flex flex-wrap gap-3">
            {metrics.topBlockedDomains.map((domain, index) => (
              <div key={domain.domain} className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <span className="text-sm font-medium text-gray-900">@{domain.domain}</span>
                <span className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded-full">
                  {domain.count} {domain.count === 1 ? 'block' : 'blocks'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by email, IP, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={clearFilters}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Clear Filters
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BlockStatus | 'all')}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="manual">Manually Unblocked</option>
            </select>
          </div>

          <select
            value={appTypeFilter}
            onChange={(e) => setAppTypeFilter(e.target.value as AppType)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All App Types</option>
            <option value="business">Business</option>
            <option value="user">User</option>
          </select>

          <input
            type="date"
            value={dateRange.start?.toISOString().split('T')[0] || ''}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value ? new Date(e.target.value) : null }))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={dateRange.end?.toISOString().split('T')[0] || ''}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value ? new Date(e.target.value) : null }))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="End Date"
          />

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
          </select>
        </div>
      </div>

      {/* Blocked Logins Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email / User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  App Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Failed Attempts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time Remaining
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Failed
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
                    <p className="text-gray-500 mt-2">Loading blocked logins...</p>
                  </td>
                </tr>
              ) : paginatedLogins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-gray-400">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                      <p>No blocked logins found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogins.map((block) => (
                  <tr
                    key={block.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          block.appType === 'business' ? 'bg-blue-100' : 'bg-green-100'
                        }`}>
                          {getAppTypeIcon(block.appType)}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {block.email}
                          </div>
                          <div className="text-xs text-gray-500">
                            {block.ipAddress || 'No IP recorded'}
                          </div>
                          {block.location && (
                            <div className="text-xs text-gray-400 mt-1">
                              {block.location.city}, {block.location.country}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        block.appType === 'business' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {getAppTypeIcon(block.appType)}
                        {block.appType === 'business' ? 'Business' : 'User'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          block.failedAttempts >= 3 ? 'bg-red-100' : 'bg-yellow-100'
                        }`}>
                          <span className={`text-sm font-bold ${
                            block.failedAttempts >= 3 ? 'text-red-600' : 'text-yellow-600'
                          }`}>
                            {block.failedAttempts}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm text-gray-900">
                            {block.failedAttempts} attempt{block.failedAttempts !== 1 ? 's' : ''}
                          </div>
                          {block.failedAttempts >= 3 && (
                            <div className="text-xs text-red-500">
                              Triggered block
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(block)}`}>
                        {getStatusIcon(block)}
                        {getStatusText(block)}
                      </span>
                      {block.manuallyUnblocked && block.unblockedBy && (
                        <div className="text-xs text-gray-500 mt-1">
                          By: {block.unblockedBy}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {block.isActive ? (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-orange-500" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatTimeRemaining(block.blockedUntil)}
                            </div>
                            <div className="text-xs text-gray-500">
                              Until {formatDate(block.blockedUntil)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {block.manuallyUnblocked ? 'Manually ended' : 'Auto expired'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {formatDate(block.lastFailedAt)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDistanceToNow(block.lastFailedAt.toDate(), { addSuffix: true })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedBlock(block)}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          Details
                        </button>
                        {block.isActive && (
                          <button
                            onClick={() => confirmUnblock(block.id)}
                            disabled={unblockLoading === block.id}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 text-sm disabled:opacity-50"
                          >
                            {unblockLoading === block.id ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <Unlock className="w-4 h-4" />
                            )}
                            Unblock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && paginatedLogins.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredLogins.length)}-
                {Math.min(currentPage * pageSize, filteredLogins.length)} of {filteredLogins.length}
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

      {/* Unblock Confirmation Modal */}
      {showUnblockConfirm && blockToUnblock && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => {
            setShowUnblockConfirm(false);
            setBlockToUnblock(null);
          }} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Unlock className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Unblock Account
                  </h3>
                  <p className="text-sm text-gray-500">
                    Confirm manual unblock action
                  </p>
                </div>
              </div>
              
              <p className="text-gray-700 mb-6">
                Are you sure you want to manually unblock this account? This will allow the user to attempt login immediately.
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">Security Note</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      This action will be logged for security auditing. Only unblock accounts that have been verified as legitimate.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowUnblockConfirm(false);
                    setBlockToUnblock(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const block = blockedLogins.find(b => b.id === blockToUnblock);
                    if (block) {
                      handleUnblock(blockToUnblock, block.email);
                    }
                  }}
                  disabled={unblockLoading === blockToUnblock}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {unblockLoading === blockToUnblock ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Unblocking...
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      Confirm Unblock
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Details Modal */}
      {selectedBlock && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedBlock(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Block Details
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Block ID: {selectedBlock.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedBlock.isActive && (
                    <button
                      onClick={() => confirmUnblock(selectedBlock.id)}
                      disabled={unblockLoading === selectedBlock.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      {unblockLoading === selectedBlock.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                      Unblock
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedBlock(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Email Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Account Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Email Address</label>
                        <p className="text-gray-900 font-medium">{selectedBlock.email}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">App Type</label>
                        <div className="flex items-center gap-2 mt-1">
                          {getAppTypeIcon(selectedBlock.appType)}
                          <span className="text-gray-900 font-medium capitalize">
                            {selectedBlock.appType}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Failed Attempts</label>
                        <p className="text-gray-900 font-medium">{selectedBlock.failedAttempts}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Status</label>
                        <div className="mt-1">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full border ${getStatusColor(selectedBlock)}`}>
                            {getStatusIcon(selectedBlock)}
                            {getStatusText(selectedBlock)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Block Timeline</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <History className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">First Failed Attempt</p>
                        <p className="text-sm text-gray-500">{formatDate(selectedBlock.firstFailedAt)}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(selectedBlock.firstFailedAt.toDate(), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-red-100 rounded-full">
                        <Ban className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Last Failed Attempt</p>
                        <p className="text-sm text-gray-500">{formatDate(selectedBlock.lastFailedAt)}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Triggered after {selectedBlock.failedAttempts} failed attempt{selectedBlock.failedAttempts !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-orange-100 rounded-full">
                        <Lock className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Blocked Until</p>
                        <p className="text-sm text-gray-500">{formatDate(selectedBlock.blockedUntil)}</p>
                        {selectedBlock.isActive && (
                          <p className="text-sm text-orange-600 font-medium mt-1">
                            Time remaining: {formatTimeRemaining(selectedBlock.blockedUntil)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {selectedBlock.manuallyUnblocked && selectedBlock.unblockedAt && (
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-full">
                          <Unlock className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Manually Unblocked</p>
                          <p className="text-sm text-gray-500">{formatDate(selectedBlock.unblockedAt)}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            By: {selectedBlock.unblockedBy || 'Administrator'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location Info */}
                {selectedBlock.location && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Information</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm text-gray-500">IP Address</label>
                          <p className="text-gray-900 font-medium">{selectedBlock.ipAddress || 'Not recorded'}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">City</label>
                          <p className="text-gray-900 font-medium">{selectedBlock.location.city}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Region</label>
                          <p className="text-gray-900 font-medium">{selectedBlock.location.region}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Country</label>
                          <p className="text-gray-900 font-medium">{selectedBlock.location.country}</p>
                        </div>
                        <div>
                          <label className="text-sm text-gray-500">Organization</label>
                          <p className="text-gray-900 font-medium">{selectedBlock.location.org}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* User/Business Info */}
                {(selectedBlock.userId || selectedBlock.businessId) && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {selectedBlock.appType === 'business' ? 'Business' : 'User'} Information
                    </h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {selectedBlock.userId && (
                          <div>
                            <label className="text-sm text-gray-500">User ID</label>
                            <p className="text-gray-900 font-medium text-sm">{selectedBlock.userId}</p>
                          </div>
                        )}
                        {selectedBlock.businessId && (
                          <div>
                            <label className="text-sm text-gray-500">Business ID</label>
                            <p className="text-gray-900 font-medium text-sm">{selectedBlock.businessId}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Security Actions */}
                {selectedBlock.isActive && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Actions</h3>
                    <div className="space-y-3">
                      <button
                        onClick={() => confirmUnblock(selectedBlock.id)}
                        disabled={unblockLoading === selectedBlock.id}
                        className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                      >
                        {unblockLoading === selectedBlock.id ? (
                          <>
                            <Loader className="w-5 h-5 animate-spin" />
                            Unblocking...
                          </>
                        ) : (
                          <>
                            <Unlock className="w-5 h-5" />
                            Unblock This Account
                          </>
                        )}
                      </button>
                      
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-yellow-800 font-medium">Recommended Actions</p>
                            <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                              <li>• Contact user to verify legitimate access attempts</li>
                              <li>• Review recent login logs for suspicious patterns</li>
                              <li>• Consider enabling 2FA for this account</li>
                              <li>• Monitor for repeated blocks after unblocking</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}