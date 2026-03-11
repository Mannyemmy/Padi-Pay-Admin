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
  Download,
  RefreshCw,
  AlertCircle,
  Shield,
  BarChart3,
  Loader,
  User,
  MapPin,
  Globe,
  Calendar,
  LogIn,
  Smartphone,
  Computer,
  Wifi,
  Info,
  Phone
} from 'lucide-react';
import { collection, getDocs, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { showToast } from '@/components/Toast';
import { ExportMenu } from '@/components/ExportMenu';
import { useDemoMode } from '@/lib/demo';

type LoginStatus = 'success' | 'failed';
type LoginMethod = 'email_password' | 'biometric' | 'unknown';
type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'unknown';

interface LoginLog {
  id: string;
  email: string;
  success: boolean;
  errorMessage: string | null;
  ip: string;
  location: {
    city: string;
    country: string;
    region: string;
    org: string;
  };
  deviceInfo: {
    device: string;
    os: string;
    manufacturer: string;
  };
  networkType: string;
  timestamp: Timestamp | string | number;
  userAgent: string;
  loginMethod?: LoginMethod;
  deviceType?: DeviceType;
  userId?: string;
}

interface LoginMetrics {
  totalLogs: number;
  successfulLogins: number;
  failedLogins: number;
  successRate: number;
  uniqueIps: number;
  uniqueCountries: number;
  activeHours: number;
  averageLoginsPerDay: number;
}

export default function LoginLogsPage() {
  const demoMode = useDemoMode();
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<LoginStatus | 'all'>('all');
  const [methodFilter, setMethodFilter] = useState<LoginMethod | 'all'>('all');
  const [deviceFilter, setDeviceFilter] = useState<DeviceType | 'all'>('all');
  const [selectedLog, setSelectedLog] = useState<LoginLog | null>(null);
  const [metrics, setMetrics] = useState<LoginMetrics>({
    totalLogs: 0,
    successfulLogins: 0,
    failedLogins: 0,
    successRate: 0,
    uniqueIps: 0,
    uniqueCountries: 0,
    activeHours: 0,
    averageLoginsPerDay: 0
  });
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });

  // Fetch login logs from Firestore
  useEffect(() => {
    const fetchLoginLogs = async () => {
      try {
        setLoading(true);
        const logsRef = collection(db, 'loginLogs');
        const constraints: any[] = [orderBy('timestamp', 'desc')];
        if (demoMode) constraints.unshift(where('mock', '==', true));
        const q = query(logsRef, ...constraints);
        const querySnapshot = await getDocs(q);
        
        const logs: LoginLog[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          logs.push({
            id: doc.id,
            email: data.email || 'Unknown',
            success: data.success || false,
            errorMessage: data.errorMessage || null,
            ip: data.ip || 'Unknown',
            location: data.location || {
              city: 'Unknown',
              country: 'Unknown',
              region: 'Unknown',
              org: 'Unknown'
            },
            deviceInfo: data.deviceInfo || {
              device: 'Unknown',
              os: 'Unknown',
              manufacturer: 'Unknown'
            },
            networkType: data.networkType || 'Unknown',
            timestamp: data.timestamp,
            userAgent: data.userAgent || 'Unknown',
            loginMethod: data.loginMethod || 'unknown',
            deviceType: data.deviceType || 'unknown',
            userId: data.userId
          });
        });
        
        setLoginLogs(logs);
        setError(null);
      } catch (err) {
        console.error('Error fetching login logs:', err);
        setError('Failed to load login logs');
        showToast('error', 'Load Failed', 'Failed to load login logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLoginLogs();
  }, []);

  // Calculate metrics
  useEffect(() => {
    if (loginLogs.length === 0) return;

    const successfulLogins = loginLogs.filter(log => log.success).length;
    const failedLogins = loginLogs.filter(log => !log.success).length;
    const successRate = loginLogs.length > 0 ? (successfulLogins / loginLogs.length) * 100 : 0;
    
    // Get unique IPs
    const uniqueIps = new Set(loginLogs.map(log => log.ip)).size;
    
    // Get unique countries
    const uniqueCountries = new Set(loginLogs.map(log => log.location.country)).size;
    
    // Calculate active hours (logs in last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeHours = loginLogs.filter(log => {
      const ts = log.timestamp instanceof Timestamp ? log.timestamp.toDate() : new Date(log.timestamp);
      return ts > twentyFourHoursAgo;
    }).length;
    
    // Calculate average logins per day
    const logsByDate: { [date: string]: number } = {};
    loginLogs.forEach(log => {
      const ts = log.timestamp instanceof Timestamp ? log.timestamp.toDate() : new Date(log.timestamp);
      const date = ts.toISOString().split('T')[0];
      logsByDate[date] = (logsByDate[date] || 0) + 1;
    });
    const averageLoginsPerDay = Object.keys(logsByDate).length > 0 
      ? Object.values(logsByDate).reduce((a, b) => a + b, 0) / Object.keys(logsByDate).length 
      : 0;

    setMetrics({
      totalLogs: loginLogs.length,
      successfulLogins,
      failedLogins,
      successRate,
      uniqueIps,
      uniqueCountries,
      activeHours,
      averageLoginsPerDay: Math.round(averageLoginsPerDay)
    });
  }, [loginLogs]);

  const getDeviceType = (deviceInfo: LoginLog['deviceInfo'], userAgent: string): DeviceType => {
    const { device, os } = deviceInfo;
    const agent = userAgent.toLowerCase();
    
    if (device.toLowerCase().includes('iphone') || 
        device.toLowerCase().includes('android') ||
        agent.includes('mobile') ||
        agent.includes('iphone') ||
        agent.includes('android')) {
      return 'mobile';
    } else if (device.toLowerCase().includes('ipad') || 
               agent.includes('ipad') ||
               agent.includes('tablet')) {
      return 'tablet';
    } else if (device.toLowerCase().includes('mac') || 
               device.toLowerCase().includes('windows') ||
               agent.includes('windows') ||
               agent.includes('macintosh')) {
      return 'desktop';
    }
    return 'unknown';
  };

  const inferLoginMethod = (errorMessage: string | null): LoginMethod => {
    if (errorMessage?.toLowerCase().includes('biometric')) {
      return 'biometric';
    } else if (errorMessage?.toLowerCase().includes('password') || 
               errorMessage?.toLowerCase().includes('email')) {
      return 'email_password';
    }
    return 'unknown';
  };

  const processedLogs = useMemo(() => {
    return loginLogs.map(log => ({
      ...log,
      deviceType: getDeviceType(log.deviceInfo, log.userAgent),
      loginMethod: inferLoginMethod(log.errorMessage)
    }));
  }, [loginLogs]);

  const filteredLogs = useMemo(() => {
    return processedLogs.filter(log => {
      // Search filter
      const matchesSearch = 
        log.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ip.includes(searchTerm) ||
        log.location.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.location.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.deviceInfo.device.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'success' ? log.success : !log.success);
      
      // Method filter
      const matchesMethod = methodFilter === 'all' || log.loginMethod === methodFilter;
      
      // Device filter
      const matchesDevice = deviceFilter === 'all' || log.deviceType === deviceFilter;
      
      // Date range filter
      const logDate = log.timestamp instanceof Timestamp ? log.timestamp.toDate() : new Date(log.timestamp);
      const matchesDate = (!dateRange.start || logDate >= dateRange.start) && 
                         (!dateRange.end || logDate <= dateRange.end);

      return matchesSearch && matchesStatus && matchesMethod && matchesDevice && matchesDate;
    });
  }, [processedLogs, searchTerm, statusFilter, methodFilter, deviceFilter, dateRange]);

  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  const handleRefresh = async () => {
    setRefreshLoading(true);
    try {
      const logsRef = collection(db, 'loginLogs');
      const q = query(logsRef, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const logs: LoginLog[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          email: data.email || 'Unknown',
          success: data.success || false,
          errorMessage: data.errorMessage || null,
          ip: data.ip || 'Unknown',
          location: data.location || {
            city: 'Unknown',
            country: 'Unknown',
            region: 'Unknown',
            org: 'Unknown'
          },
          deviceInfo: data.deviceInfo || {
            device: 'Unknown',
            os: 'Unknown',
            manufacturer: 'Unknown'
          },
          networkType: data.networkType || 'Unknown',
          timestamp: data.timestamp,
          userAgent: data.userAgent || 'Unknown'
        });
      });
      
      setLoginLogs(logs);
      showToast('success', 'Refreshed', 'Login logs have been refreshed');
    } catch (err) {
      console.error('Error refreshing logs:', err);
      showToast('error', 'Refresh Failed', 'Failed to refresh login logs');
    } finally {
      setRefreshLoading(false);
    }
  };

  const getStatusColor = (success: boolean) => {
    return success 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-red-100 text-red-800 border-red-200';
  };

  const getStatusIcon = (success: boolean) => {
    return success 
      ? <CheckCircle className="w-4 h-4" /> 
      : <XCircle className="w-4 h-4" />;
  };

  const getMethodIcon = (method: LoginMethod) => {
    switch (method) {
      case 'email_password':
        return <LogIn className="w-4 h-4" />;
      case 'biometric':
        return <Shield className="w-4 h-4" />;
      case 'unknown':
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />;
      case 'desktop':
        return <Computer className="w-4 h-4" />;
      case 'tablet':
        return <Phone className="w-4 h-4" />;
      case 'unknown':
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getNetworkIcon = (networkType: string) => {
    if (networkType.toLowerCase().includes('wifi')) {
      return <Wifi className="w-4 h-4" />;
    }
    return <Globe className="w-4 h-4" />;
  };

  const formatDate = (timestamp: Timestamp | string | number) => {
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const toDate = (timestamp: Timestamp | string | number): Date =>
    timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);

  const exportData = processedLogs.map(log => ({
    id: log.id,
    email: log.email,
    success: log.success,
    errorMessage: log.errorMessage,
    ip: log.ip,
    city: log.location.city,
    country: log.location.country,
    region: log.location.region,
    org: log.location.org,
    device: log.deviceInfo.device,
    os: log.deviceInfo.os,
    manufacturer: log.deviceInfo.manufacturer,
    networkType: log.networkType,
    userAgent: log.userAgent,
    timestamp: log.timestamp.toDate().toISOString(),
    loginMethod: log.loginMethod,
    deviceType: log.deviceType
  }));

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setMethodFilter('all');
    setDeviceFilter('all');
    setDateRange({ start: null, end: null });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Login Logs
            </h1>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
              Monitor user authentication activities and security events
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
              filenameBase="login-logs"
              title="Login Logs Export"
              renderPrint={(data) => {
                const rows = data.map((r: any) => `
                  <tr>
                    <td>${r.email}</td>
                    <td>${r.success ? 'Success' : 'Failed'}</td>
                    <td>${r.errorMessage || 'N/A'}</td>
                    <td>${r.ip}</td>
                    <td>${r.city}, ${r.country}</td>
                    <td>${r.device} (${r.os})</td>
                    <td>${r.loginMethod}</td>
                    <td>${new Date(r.timestamp).toLocaleString()}</td>
                  </tr>
                `).join('');
                return `
                  <h1>Login Logs</h1>
                  <table border="1" cellpadding="6" cellspacing="0">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Error Message</th>
                        <th>IP Address</th>
                        <th>Location</th>
                        <th>Device</th>
                        <th>Method</th>
                        <th>Timestamp</th>
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
              <p className="text-sm text-gray-500">Total Logins</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalLogs}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <LogIn className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Last 24h: {metrics.activeHours}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.successRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Successful: {metrics.successfulLogins}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Unique IPs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.uniqueIps}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Globe className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Countries: {metrics.uniqueCountries}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg. Daily Logins</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.averageLoginsPerDay}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Average per day
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-800 font-medium">Successful Logins</p>
              <p className="text-2xl font-bold text-green-900 mt-1">{metrics.successfulLogins}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-800 font-medium">Failed Logins</p>
              <p className="text-2xl font-bold text-red-900 mt-1">{metrics.failedLogins}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by email, IP, location, or device..."
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
              onChange={(e) => setStatusFilter(e.target.value as LoginStatus | 'all')}
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="success">Successful</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as LoginMethod | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Methods</option>
            <option value="email_password">Email/Password</option>
            <option value="biometric">Biometric</option>
            <option value="unknown">Unknown</option>
          </select>

          <select
            value={deviceFilter}
            onChange={(e) => setDeviceFilter(e.target.value as DeviceType | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Devices</option>
            <option value="mobile">Mobile</option>
            <option value="desktop">Desktop</option>
            <option value="tablet">Tablet</option>
            <option value="unknown">Unknown</option>
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
        </div>
      </div>

      {/* Login Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
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
                    <p className="text-gray-500 mt-2">Loading login logs...</p>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-gray-400">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                      <p>No login logs found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {log.email}
                          </div>
                          <div className="text-xs text-gray-500">
                            IP: {log.ip}
                          </div>
                          {log.errorMessage && !log.success && (
                            <div className="text-xs text-red-500 mt-1 truncate max-w-xs">
                              {log.errorMessage}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(log.success)}`}>
                        {getStatusIcon(log.success)}
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm text-gray-900">
                            {log.location.city}, {log.location.region}
                          </div>
                          <div className="text-xs text-gray-500">
                            {log.location.country}
                          </div>
                          <div className="text-xs text-gray-400">
                            {log.location.org}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(log.deviceType || 'unknown')}
                        <div>
                          <div className="text-sm text-gray-900">
                            {log.deviceInfo.device}
                          </div>
                          <div className="text-xs text-gray-500">
                            {log.deviceInfo.os}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            {getNetworkIcon(log.networkType)}
                            <span className="text-xs text-gray-400">
                              {log.networkType}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getMethodIcon(log.loginMethod || 'unknown')}
                        <span className="text-sm text-gray-900 capitalize">
                          {log.loginMethod?.replace('_', ' ') || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {formatDate(log.timestamp)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {log.timestamp.toDate().toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && paginatedLogs.length > 0 && (
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
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredLogs.length)}-
                {Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length}
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

      {/* Login Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedLog(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Login Attempt Details
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Log ID: {selectedLog.id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
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
                    User Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="text-gray-900 font-medium">{selectedLog.email}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">User ID</label>
                      <p className="text-gray-900 font-medium">{selectedLog.userId || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">IP Address</label>
                      <p className="text-gray-900 font-medium">{selectedLog.ip}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Login Status</label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full border ${getStatusColor(selectedLog.success)}`}>
                          {getStatusIcon(selectedLog.success)}
                          {selectedLog.success ? 'Successful' : 'Failed'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">City</label>
                        <p className="text-gray-900 font-medium">{selectedLog.location.city}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Region</label>
                        <p className="text-gray-900 font-medium">{selectedLog.location.region}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Country</label>
                        <p className="text-gray-900 font-medium">{selectedLog.location.country}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Organization</label>
                        <p className="text-gray-900 font-medium">{selectedLog.location.org}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Device Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Device Type</label>
                        <div className="flex items-center gap-2 mt-1">
                          {getDeviceIcon(selectedLog.deviceType || 'unknown')}
                          <span className="text-gray-900 font-medium capitalize">
                            {selectedLog.deviceType}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Login Method</label>
                        <div className="flex items-center gap-2 mt-1">
                          {getMethodIcon(selectedLog.loginMethod || 'unknown')}
                          <span className="text-gray-900 font-medium capitalize">
                            {selectedLog.loginMethod?.replace('_', ' ') || 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Device Model</label>
                        <p className="text-gray-900 font-medium">{selectedLog.deviceInfo.device}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Operating System</label>
                        <p className="text-gray-900 font-medium">{selectedLog.deviceInfo.os}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Manufacturer</label>
                        <p className="text-gray-900 font-medium">{selectedLog.deviceInfo.manufacturer}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Network Type</label>
                        <div className="flex items-center gap-2 mt-1">
                          {getNetworkIcon(selectedLog.networkType)}
                          <span className="text-gray-900 font-medium capitalize">
                            {selectedLog.networkType}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Error Details */}
                {!selectedLog.success && selectedLog.errorMessage && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Details</h3>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-red-800 font-medium">Error Message:</p>
                          <p className="text-red-700 mt-1">{selectedLog.errorMessage}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Timestamp</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Date & Time</label>
                        <p className="text-gray-900 font-medium">{formatDate(selectedLog.timestamp)}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">User Agent</label>
                        <p className="text-gray-900 font-medium text-sm">{selectedLog.userAgent}</p>
                      </div>
                    </div>
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