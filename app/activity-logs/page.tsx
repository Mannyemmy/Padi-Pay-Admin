"use client";

import { useState, useEffect, useMemo } from "react";
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
  Phone,
  Users,
  FileText,
  Home,
  Lock,
  LogOut,
  Database,
  Activity,
  Timer,
} from "lucide-react";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { showToast } from "@/components/Toast";
import { ExportMenu } from "@/components/ExportMenu";
import { allRoutes } from "@/lib/routes";
import { useDemoMode } from "@/lib/demo";

type ActivityType = "page_view" | "api_call" | "login" | "logout";
type DeviceType = "mobile" | "desktop" | "tablet" | "unknown";

interface ActivityLog {
  id: string;
  adminId: string;
  adminEmail: string;
  adminName: string;
  route: string;
  action: ActivityType;
  startTime: number;
  endTime?: number;
  duration?: number;
  userAgent: string;
  ipAddress: string;
  method?: string;
  statusCode?: number;
  metadata?: Record<string, any>;
  createdAt: number;
}

interface ActivityMetrics {
  totalActivities: number;
  totalPageViews: number;
  totalApiCalls: number;
  totalLogins: number;
  totalLogouts: number;
  averageDuration: number;
  uniqueAdmins: number;
  uniqueIps: number;
  activeToday: number;
  peakHour: string;
}

export default function ActivityLogsPage() {
  const demoMode = useDemoMode();
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<ActivityType | "all">("all");
  const [adminFilter, setAdminFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [metrics, setMetrics] = useState<ActivityMetrics>({
    totalActivities: 0,
    totalPageViews: 0,
    totalApiCalls: 0,
    totalLogins: 0,
    totalLogouts: 0,
    averageDuration: 0,
    uniqueAdmins: 0,
    uniqueIps: 0,
    activeToday: 0,
    peakHour: "N/A",
  });
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dateRange, setDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({
    start: null,
    end: null,
  });
  const [allAdmins, setAllAdmins] = useState<
    { id: string; email: string; name: string }[]
  >([]);
  // Helper function to get route name from path
  const getRouteName = (path: string): string => {
    // Handle special cases first
    if (path === "/") return "Dashboard";

    // Remove trailing slashes for matching
    const cleanPath = path.replace(/\/$/, "");

    // Find route by href
    const route = allRoutes.find((route) => {
      // Compare paths, handle optional trailing slash
      const routePath = route.href.replace(/\/$/, "");
      return routePath === cleanPath;
    });

    // Return route name or fallback to path
    return route ? route.name : path;
  };
  // Fetch activity logs from Firestore
  useEffect(() => {
    const fetchActivityLogs = async () => {
      try {
        setLoading(true);
        const logsRef = collection(db, "activityLogs");
        const constraints: any[] = [orderBy("createdAt", "desc"), limit(1000)];
        if (demoMode) constraints.unshift(where("mock", "==", true));
        const q = query(logsRef, ...constraints);
        const querySnapshot = await getDocs(q);

        const logs: ActivityLog[] = [];
        const adminSet = new Set<string>();
        const adminMap = new Map<string, { email: string; name: string }>();

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          logs.push({
            id: doc.id,
            adminId: data.adminId || "unknown",
            adminEmail: data.adminEmail || "unknown",
            adminName: data.adminName || "Unknown",
            route: data.route || "/",
            action: data.action || "page_view",
            startTime: data.startTime || 0,
            endTime: data.endTime,
            duration: data.duration,
            userAgent: data.userAgent || "Unknown",
            ipAddress: data.ipAddress || "Unknown",
            method: data.method,
            statusCode: data.statusCode,
            metadata: data.metadata || {},
            createdAt: data.createdAt || Date.now(),
          });

          // Collect unique admins
          if (data.adminId && data.adminEmail && data.adminName) {
            adminSet.add(data.adminId);
            adminMap.set(data.adminId, {
              email: data.adminEmail,
              name: data.adminName,
            });
          }
        });

        setActivityLogs(logs);

        // Set unique admins for filter
        const adminList = Array.from(adminMap.entries()).map(([id, info]) => ({
          id,
          email: info.email,
          name: info.name,
        }));
        setAllAdmins(adminList);

        setError(null);
      } catch (err) {
        console.error("Error fetching activity logs:", err);
        setError("Failed to load activity logs");
        showToast("error", "Load Failed", "Failed to load activity logs");
      } finally {
        setLoading(false);
      }
    };

    fetchActivityLogs();
  }, [demoMode]);

  // Calculate metrics
  useEffect(() => {
    if (activityLogs.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalPageViews = activityLogs.filter(
      (log) => log.action === "page_view",
    ).length;
    const totalApiCalls = activityLogs.filter(
      (log) => log.action === "api_call",
    ).length;
    const totalLogins = activityLogs.filter(
      (log) => log.action === "login",
    ).length;
    const totalLogouts = activityLogs.filter(
      (log) => log.action === "logout",
    ).length;

    // Calculate average duration (for page views with duration)
    const pageViewsWithDuration = activityLogs.filter(
      (log) => log.action === "page_view" && log.duration,
    );
    const averageDuration =
      pageViewsWithDuration.length > 0
        ? pageViewsWithDuration.reduce(
            (sum, log) => sum + (log.duration || 0),
            0,
          ) / pageViewsWithDuration.length
        : 0;

    // Get unique admins and IPs
    const uniqueAdmins = new Set(activityLogs.map((log) => log.adminId)).size;
    const uniqueIps = new Set(activityLogs.map((log) => log.ipAddress)).size;

    // Count activities today
    const activeToday = activityLogs.filter((log) => {
      const logDate = new Date(log.startTime);
      return logDate >= today;
    }).length;

    // Find peak hour
    const hourCounts: { [hour: string]: number } = {};
    activityLogs.forEach((log) => {
      const hour = new Date(log.startTime).getHours();
      const hourKey = `${hour}:00`;
      hourCounts[hourKey] = (hourCounts[hourKey] || 0) + 1;
    });

    const peakHour = Object.entries(hourCounts).reduce(
      (peak, [hour, count]) => {
        return count > (peak.count || 0) ? { hour, count } : peak;
      },
      { hour: "N/A", count: 0 },
    );

    setMetrics({
      totalActivities: activityLogs.length,
      totalPageViews,
      totalApiCalls,
      totalLogins,
      totalLogouts,
      averageDuration,
      uniqueAdmins,
      uniqueIps,
      activeToday,
      peakHour: peakHour.hour,
    });
  }, [activityLogs]);

  const getDeviceType = (userAgent: string): DeviceType => {
    const agent = userAgent.toLowerCase();

    if (
      agent.includes("mobile") ||
      agent.includes("iphone") ||
      agent.includes("android")
    ) {
      return "mobile";
    } else if (agent.includes("ipad") || agent.includes("tablet")) {
      return "tablet";
    } else if (
      agent.includes("windows") ||
      agent.includes("macintosh") ||
      agent.includes("linux")
    ) {
      return "desktop";
    }
    return "unknown";
  };

  const filteredLogs = useMemo(() => {
    return activityLogs.filter((log) => {
      // Search filter
      const matchesSearch =
        log.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.route.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.ipAddress.includes(searchTerm) ||
        log.userAgent.toLowerCase().includes(searchTerm.toLowerCase());

      // Action filter
      const matchesAction =
        actionFilter === "all" || log.action === actionFilter;

      // Admin filter
      const matchesAdmin = adminFilter === "all" || log.adminId === adminFilter;

      // Date range filter
      const logDate = new Date(log.startTime);
      const matchesDate =
        (!dateRange.start || logDate >= dateRange.start) &&
        (!dateRange.end || logDate <= dateRange.end);

      return matchesSearch && matchesAction && matchesAdmin && matchesDate;
    });
  }, [activityLogs, searchTerm, actionFilter, adminFilter, dateRange]);

  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  const handleRefresh = async () => {
    setRefreshLoading(true);
    try {
      const logsRef = collection(db, "activityLogs");
      const q = query(logsRef, orderBy("createdAt", "desc"), limit(1000));
      const querySnapshot = await getDocs(q);

      const logs: ActivityLog[] = [];
      const adminMap = new Map<string, { email: string; name: string }>();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          adminId: data.adminId || "unknown",
          adminEmail: data.adminEmail || "unknown",
          adminName: data.adminName || "Unknown",
          route: data.route || "/",
          action: data.action || "page_view",
          startTime: data.startTime || 0,
          endTime: data.endTime,
          duration: data.duration,
          userAgent: data.userAgent || "Unknown",
          ipAddress: data.ipAddress || "Unknown",
          method: data.method,
          statusCode: data.statusCode,
          metadata: data.metadata || {},
          createdAt: data.createdAt || Date.now(),
        });

        if (data.adminId && data.adminEmail && data.adminName) {
          adminMap.set(data.adminId, {
            email: data.adminEmail,
            name: data.adminName,
          });
        }
      });

      setActivityLogs(logs);

      const adminList = Array.from(adminMap.entries()).map(([id, info]) => ({
        id,
        email: info.email,
        name: info.name,
      }));
      setAllAdmins(adminList);

      showToast("success", "Refreshed", "Activity logs have been refreshed");
    } catch (err) {
      console.error("Error refreshing logs:", err);
      showToast("error", "Refresh Failed", "Failed to refresh activity logs");
    } finally {
      setRefreshLoading(false);
    }
  };

  const getActionIcon = (action: ActivityType) => {
    switch (action) {
      case "page_view":
        return <Home className="w-4 h-4" />;
      case "api_call":
        return <Database className="w-4 h-4" />;
      case "login":
        return <LogIn className="w-4 h-4" />;
      case "logout":
        return <LogOut className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: ActivityType) => {
    switch (action) {
      case "page_view":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "api_call":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "login":
        return "bg-green-100 text-green-800 border-green-200";
      case "logout":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getDeviceIcon = (type: DeviceType) => {
    switch (type) {
      case "mobile":
        return <Smartphone className="w-4 h-4" />;
      case "desktop":
        return <Computer className="w-4 h-4" />;
      case "tablet":
        return <Phone className="w-4 h-4" />;
      case "unknown":
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getHttpMethodColor = (method?: string) => {
    switch (method?.toUpperCase()) {
      case "GET":
        return "bg-blue-100 text-blue-800";
      case "POST":
        return "bg-green-100 text-green-800";
      case "PUT":
        return "bg-yellow-100 text-yellow-800";
      case "DELETE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return "N/A";
    if (duration < 1000) return `${duration}ms`;
    const seconds = Math.floor(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };
  const exportData = filteredLogs.map((log) => ({
    id: log.id,
    adminId: log.adminId,
    adminEmail: log.adminEmail,
    adminName: log.adminName,
    route: log.route,
    routeName: getRouteName(log.route), // Add this line
    action: log.action,
    startTime: new Date(log.startTime).toISOString(),
    endTime: log.endTime ? new Date(log.endTime).toISOString() : "N/A",
    duration: formatDuration(log.duration),
    durationMs: log.duration || 0,
    userAgent: log.userAgent,
    ipAddress: log.ipAddress,
    method: log.method || "N/A",
    statusCode: log.statusCode || "N/A",
    deviceType: getDeviceType(log.userAgent),
    timestamp: new Date(log.createdAt).toISOString(),
  }));

  const clearFilters = () => {
    setSearchTerm("");
    setActionFilter("all");
    setAdminFilter("all");
    setDateRange({ start: null, end: null });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Activity Logs
            </h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              Monitor admin activities, page views, and more
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 text-white"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshLoading ? "animate-spin" : ""}`}
              />
              {refreshLoading ? "Refreshing..." : "Refresh"}
            </button>
            <ExportMenu
              data={exportData}
              filenameBase="activity-logs"
              title="Activity Logs Export"
              renderPrint={(data) => {
                const rows = data
                  .map(
                    (r: any) => `
    <tr>
      <td>${r.adminName} (${r.adminEmail})</td>
      <td>${r.action.replace("_", " ")}</td>
      <td>${r.routeName}</td> <!-- Changed from r.route to r.routeName -->
      <td>${r.duration}</td>
      <td>${r.ipAddress}</td>
      <td>${r.deviceType}</td>
      <td>${new Date(r.startTime).toLocaleString()}</td>
    </tr>
  `,
                  )
                  .join("");
                return `
    <h1>Activity Logs</h1>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr>
          <th>Admin</th>
          <th>Action</th>
          <th>Route</th> <!-- You might want to update this header too -->
          <th>Duration</th>
          <th>IP Address</th>
          <th>Device</th>
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
              <p className="text-sm text-gray-500">Total Activities</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.totalActivities}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Today: {metrics.activeToday}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Admins</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.uniqueAdmins}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Unique IPs: {metrics.uniqueIps}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg. Duration</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.averageDuration > 0
                  ? formatDuration(metrics.averageDuration)
                  : "N/A"}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Timer className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Page Views: {metrics.totalPageViews}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Peak Hour</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.peakHour}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        
        </div>
      </div>

      {/* Activity Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-800 font-medium">Page Views</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {metrics.totalPageViews}
              </p>
            </div>
            <Home className="w-8 h-8 text-blue-600" />
          </div>
        </div>


        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-800 font-medium">Logins</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {metrics.totalLogins}
              </p>
            </div>
            <LogIn className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-800 font-medium">Logouts</p>
              <p className="text-2xl font-bold text-red-900 mt-1">
                {metrics.totalLogouts}
              </p>
            </div>
            <LogOut className="w-8 h-8 text-red-600" />
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
              placeholder="Search by admin, route, IP, or user agent..."
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={actionFilter}
              onChange={(e) =>
                setActionFilter(e.target.value as ActivityType | "all")
              }
              className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Actions</option>
              <option value="page_view">Page Views</option>
              <option value="login">Logins</option>
              <option value="logout">Logouts</option>
            </select>
          </div>

          <select
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Admins</option>
            {allAdmins.map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name} ({admin.email})
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateRange.start?.toISOString().split("T")[0] || ""}
            onChange={(e) =>
              setDateRange((prev) => ({
                ...prev,
                start: e.target.value ? new Date(e.target.value) : null,
              }))
            }
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="Start Date"
          />

          <input
            type="date"
            value={dateRange.end?.toISOString().split("T")[0] || ""}
            onChange={(e) =>
              setDateRange((prev) => ({
                ...prev,
                end: e.target.value ? new Date(e.target.value) : null,
              }))
            }
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            placeholder="End Date"
          />
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Admin
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Route / Endpoint
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device & Location
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
                    <p className="text-gray-500 mt-2">
                      Loading activity logs...
                    </p>
                  </td>
                </tr>
              ) : paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-gray-400">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                      <p>No activity logs found</p>
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
                            {log.adminName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {log.adminEmail}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border ${getActionColor(log.action)}`}
                        >
                          {getActionIcon(log.action)}
                          {log.action.replace("_", " ")}
                        </span>
                        {log.method && (
                          <span
                            className={`px-2 py-1 text-xs rounded ${getHttpMethodColor(log.method)}`}
                          >
                            {log.method}
                          </span>
                        )}
                        {log.statusCode && (
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              log.statusCode >= 200 && log.statusCode < 300
                                ? "bg-green-100 text-green-800"
                                : log.statusCode >= 400 && log.statusCode < 500
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {log.statusCode}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {getRouteName(log.route)}
                      </div>
                      {log.metadata?.queryParams &&
                        Object.keys(log.metadata.queryParams).length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            Query: {JSON.stringify(log.metadata.queryParams)}
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {formatDuration(log.duration)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(getDeviceType(log.userAgent))}
                        <div>
                          <div className="text-sm text-gray-900">
                            {log.ipAddress}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {log.userAgent.split(" ")[0]}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {formatDateTime(log.startTime)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(log.startTime).toLocaleDateString()}
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
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <span className="text-sm text-gray-600">
                Showing{" "}
                {Math.min(
                  (currentPage - 1) * pageSize + 1,
                  filteredLogs.length,
                )}
                -{Math.min(currentPage * pageSize, filteredLogs.length)} of{" "}
                {filteredLogs.length}
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
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Activity Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedLog(null)}
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Activity Details
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
                {/* Admin Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Admin Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">
                        Admin Name
                      </label>
                      <p className="text-gray-900 font-medium">
                        {selectedLog.adminName}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="text-gray-900 font-medium">
                        {selectedLog.adminEmail}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Admin ID</label>
                      <p className="text-gray-900 font-medium font-mono text-sm">
                        {selectedLog.adminId}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Action</label>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 text-sm font-semibold rounded-full border ${getActionColor(selectedLog.action)}`}
                        >
                          {getActionIcon(selectedLog.action)}
                          {selectedLog.action.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Activity Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">
                          Route/Endpoint
                        </label>
                        <div className="mt-1">
                          <p className="text-gray-900 font-medium">
                            {getRouteName(selectedLog.route)}
                          </p>
                          <p className="text-sm text-gray-500 font-mono mt-1">
                            {selectedLog.route}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">
                          Duration
                        </label>
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-gray-400" />
                          <p className="text-gray-900 font-medium">
                            {formatDuration(selectedLog.duration)}
                          </p>
                        </div>
                      </div>
                      {selectedLog.method && (
                        <div>
                          <label className="text-sm text-gray-500">
                            HTTP Method
                          </label>
                          <p
                            className={`px-2 py-1 inline-block rounded text-sm ${getHttpMethodColor(selectedLog.method)}`}
                          >
                            {selectedLog.method}
                          </p>
                        </div>
                      )}
                      {selectedLog.statusCode && (
                        <div>
                          <label className="text-sm text-gray-500">
                            Status Code
                          </label>
                          <p
                            className={`px-2 py-1 inline-block rounded text-sm ${
                              selectedLog.statusCode >= 200 &&
                              selectedLog.statusCode < 300
                                ? "bg-green-100 text-green-800"
                                : selectedLog.statusCode >= 400 &&
                                    selectedLog.statusCode < 500
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {selectedLog.statusCode}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Technical Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Technical Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">
                          IP Address
                        </label>
                        <p className="text-gray-900 font-medium font-mono">
                          {selectedLog.ipAddress}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">
                          Device Type
                        </label>
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(getDeviceType(selectedLog.userAgent))}
                          <span className="text-gray-900 font-medium capitalize">
                            {getDeviceType(selectedLog.userAgent)}
                          </span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="text-sm text-gray-500">
                          User Agent
                        </label>
                        <p className="text-gray-900 font-medium text-sm font-mono bg-white p-2 rounded border mt-1">
                          {selectedLog.userAgent}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Timestamps
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">
                          Start Time
                        </label>
                        <p className="text-gray-900 font-medium">
                          {formatDateTime(selectedLog.startTime)}
                        </p>
                      </div>
                      {selectedLog.endTime && (
                        <div>
                          <label className="text-sm text-gray-500">
                            End Time
                          </label>
                          <p className="text-gray-900 font-medium">
                            {formatDateTime(selectedLog.endTime)}
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="text-sm text-gray-500">
                          Created At
                        </label>
                        <p className="text-gray-900 font-medium">
                          {formatDateTime(selectedLog.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                {selectedLog.metadata &&
                  Object.keys(selectedLog.metadata).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Additional Metadata
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                          {JSON.stringify(selectedLog.metadata, null, 2)}
                        </pre>
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
