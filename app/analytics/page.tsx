"use client";

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  Download,
  Filter,
  RefreshCw,
  TrendingUp,
  Users,
  ShoppingCart,
  Eye,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Home,
  Shield,
  Smartphone,
  MapPin,
  Calendar,
  User,
  AlertTriangle,
  Lock,
  Globe,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  Phone,
  MapPin as MapIcon,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase"; // Adjust the import path as needed

// Types
interface UserData {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  countryCode?: string;
  country?: string;
  state?: string;
  city?: string;
  dateOfBirth?: string;
  gender?: string;
  bvn?: string;
  nin?: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  role?: string;
  createdAt: Timestamp;

  // Address information
  address?: {
    country?: string;
    state?: string;
    city?: string;
    street?: string;
    postalCode?: number;
  };

  // Virtual account from Anchor
  getAnchorData?: {
    virtualAccount?: {
      data?: {
        attributes?: {
          accountNumber?: string;
          accountName?: string;
          bank?: {
            name?: string;
          };
          status?: string;
        };
      };
    };
  };

  // Qore ID verification
  qoreIdData?: {
    verification?: {
      approved?: string;
      state?: string;
    };
  };

  // Bridge card
  bridgeCard?: {
    is_active?: boolean;
  };

  // Stripe wallet
  stroWalletUser?: {
    data?: {
      status?: string;
      customer_id?: string;
    };
  };
}

interface LoginLogData {
  id: string;
  email: string;
  success: boolean;
  errorMessage?: string;
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
  timestamp: Timestamp;
  userAgent: string;
  appType: string;
}

interface BlockedLoginData {
  id: string;
  email: string;
  failedAttempts: number;
  firstFailedAt: Timestamp;
  lastFailedAt: Timestamp;
  blockedUntil: Timestamp;
  isActive: boolean;
  manuallyUnblocked?: boolean;
  unblockedAt?: Timestamp;
  unblockedBy?: string;
  appType: string;
}

interface AnalyticsData {
  summary: {
    totalUsers: number;
    activeUsersToday: number;
    newUsersToday: number;
    totalLoginsToday: number;
    failedLoginsToday: number;
    blockedUsers: number;
    usersWithVirtualAccounts: number;
    verifiedUsers: number;
  };
  users: UserData[];
  loginLogs: LoginLogData[];
  blockedLogins: BlockedLoginData[];
  devices: {
    device: string;
    count: number;
    percentage: number;
    uniqueUsers: number;
  }[];
  locations: {
    country: string;
    count: number;
    percentage: number;
    uniqueUsers: number;
  }[];
  dailyLogins: {
    date: string;
    successful: number;
    failed: number;
    blocked: number;
  }[];
  userVerificationStatus: {
    status: string;
    count: number;
    percentage: number;
  }[];
}

interface FilterState {
  dateRange: [Date, Date];
  userStatus: string;
  deviceType: string;
  country: string;
  verificationStatus: string;
  loginStatus: string;
}

// Custom Dialog Component
function Dialog({
  open,
  title,
  message,
  variant = "default",
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  variant?: "default" | "destructive";
  onClose: () => void;
}) {
  if (!open) return null;

  const isError = variant === "destructive";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isError ? "bg-red-100" : "bg-green-100"
            }`}
          >
            {isError ? (
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className={`px-5 py-2.5 rounded-lg font-medium transition ${
              isError
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData>({
    summary: {
      totalUsers: 0,
      activeUsersToday: 0,
      newUsersToday: 0,
      totalLoginsToday: 0,
      failedLoginsToday: 0,
      blockedUsers: 0,
      usersWithVirtualAccounts: 0,
      verifiedUsers: 0,
    },
    users: [],
    loginLogs: [],
    blockedLogins: [],
    devices: [],
    locations: [],
    dailyLogins: [],
    userVerificationStatus: [],
  });

  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    dateRange: [subDays(new Date(), 30), new Date()],
    userStatus: "all",
    deviceType: "all",
    country: "all",
    verificationStatus: "all",
    loginStatus: "all",
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogVariant, setDialogVariant] = useState<"default" | "destructive">(
    "default",
  );

  const showDialog = (
    title: string,
    message: string,
    variant: "default" | "destructive" = "default",
  ) => {
    setDialogTitle(title);
    setDialogMessage(message);
    setDialogVariant(variant);
    setDialogOpen(true);
  };

  // Colors for charts
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

 const handleFilterChange = (
  key: keyof FilterState,
  value: string | [Date | null, Date | null],
) => {
  setFilters((prev) => ({ ...prev, [key]: value }));
};


  const resetFilters = () => {
    setFilters({
      dateRange: [subDays(new Date(), 30), new Date()],
      userStatus: "all",
      deviceType: "all",
      country: "all",
      verificationStatus: "all",
      loginStatus: "all",
    });
  };

  // Helper function to get user's location
  const getUserLocation = (user: UserData, loginLogs: LoginLogData[]) => {
    // First try to get from user's address
    if (user.address?.country) {
      return {
        country: user.address.country,
        state: user.address.state,
        city: user.address.city,
      };
    }

    // Then try to get from login logs for this user
    const userLogs = loginLogs.filter((log) => log.email === user.email);
    if (userLogs.length > 0) {
      const latestLog = userLogs.sort(
        (a, b) => b.timestamp.toMillis() - a.timestamp.toMillis(),
      )[0];

      if (latestLog.location?.country !== "Unknown") {
        return {
          country: latestLog.location.country,
          state: latestLog.location.region,
          city: latestLog.location.city,
        };
      }
    }

    // Fallback to user's country field
    if (user.country) {
      return {
        country: user.country,
        state: user.state,
        city: user.city,
      };
    }

    return {
      country: "Unknown",
      state: "Unknown",
      city: "Unknown",
    };
  };

  // Helper function to check if user has virtual account
  const hasVirtualAccount = (user: UserData): boolean => {
    return !!user.getAnchorData?.virtualAccount?.data?.attributes
      ?.accountNumber;
  };

  // Helper function to get virtual account info
  const getVirtualAccountInfo = (user: UserData) => {
    if (!hasVirtualAccount(user)) return null;

    const va = user.getAnchorData?.virtualAccount?.data?.attributes;
    return {
      accountNumber: va?.accountNumber,
      accountName: va?.accountName,
      bankName: va?.bank?.name,
      status: va?.status,
    };
  };

  // Helper function to check if user is verified
  const isUserVerified = (user: UserData): boolean => {
    return (
      user.qoreIdData?.verification?.state === "complete" ||
      user.qoreIdData?.verification?.approved === "approved"
    );
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Fetch all users
      const usersSnapshot = await getDocs(collection(db, "users"));
      const users: UserData[] = usersSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as UserData,
      );

      // Calculate summary data
      const today = new Date();
      const todayStart = startOfDay(today);
      const todayEnd = endOfDay(today);

      // Fetch login logs for today
      const loginLogsQuery = query(
        collection(db, "loginLogs"),
        where("timestamp", ">=", Timestamp.fromDate(todayStart)),
        where("timestamp", "<=", Timestamp.fromDate(todayEnd)),
      );

      const loginLogsSnapshot = await getDocs(loginLogsQuery);
      const loginLogs: LoginLogData[] = loginLogsSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as LoginLogData,
      );

      // Fetch blocked logins
      const blockedLoginsSnapshot = await getDocs(
        collection(db, "blockedLogins"),
      );
      const blockedLogins: BlockedLoginData[] = blockedLoginsSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as BlockedLoginData,
      );

      // Calculate unique active users today
      const successfulLogins = loginLogs.filter((log) => log.success);
      const activeUsersToday = new Set(successfulLogins.map((log) => log.email))
        .size;

      // Calculate new users today
      const newUsersToday = users.filter((user) => {
        if (!user.createdAt) return false;
        const userCreatedDate = user.createdAt.toDate();
        return userCreatedDate >= todayStart && userCreatedDate <= todayEnd;
      }).length;

      // Calculate users with virtual accounts
      const usersWithVirtualAccounts = users.filter(hasVirtualAccount).length;

      // Calculate verified users
      const verifiedUsers = users.filter(isUserVerified).length;

      // Calculate login statistics for today
      const totalLoginsToday = loginLogs.length;
      const failedLoginsToday = loginLogs.filter((log) => !log.success).length;

      // Get active blocked users
      const activeBlockedUsers = blockedLogins.filter((block) => {
        if (!block.blockedUntil) return false;
        return block.blockedUntil.toDate() > new Date();
      }).length;

      // Calculate device distribution - DEDUPLICATED by email
      const deviceMap = new Map<
        string,
        { count: number; users: Set<string> }
      >();
      loginLogs.forEach((log) => {
        const device = log.deviceInfo?.device || "Unknown";
        const email = log.email;

        if (!deviceMap.has(device)) {
          deviceMap.set(device, { count: 0, users: new Set() });
        }

        const deviceData = deviceMap.get(device)!;
        deviceData.count++;
        deviceData.users.add(email);
      });

      const totalUniqueDevices = Array.from(deviceMap.values()).reduce(
        (sum, deviceData) => sum + deviceData.users.size,
        0,
      );

      const devices = Array.from(deviceMap.entries()).map(
        ([device, deviceData]) => ({
          device,
          count: deviceData.count,
          uniqueUsers: deviceData.users.size,
          percentage:
            totalUniqueDevices > 0
              ? (deviceData.users.size / totalUniqueDevices) * 100
              : 0,
        }),
      );

      // Calculate location distribution - DEDUPLICATED by email
      const locationMap = new Map<
        string,
        { count: number; users: Set<string> }
      >();

      // First, process users with known addresses
      users.forEach((user) => {
        const location = getUserLocation(user, loginLogs);
        const country = location.country;

        if (!locationMap.has(country)) {
          locationMap.set(country, { count: 0, users: new Set() });
        }

        const locationData = locationMap.get(country)!;
        locationData.users.add(user.email);
      });

      // Then, add from login logs for users not already counted
      loginLogs.forEach((log) => {
        const country = log.location?.country || "Unknown";
        const email = log.email;

        if (!locationMap.has(country)) {
          locationMap.set(country, { count: 0, users: new Set() });
        }

        const locationData = locationMap.get(country)!;
        // Only add if this email isn't already counted for this country
        if (!locationData.users.has(email)) {
          locationData.users.add(email);
        }
      });

      const totalUniqueLocations = Array.from(locationMap.values()).reduce(
        (sum, locationData) => sum + locationData.users.size,
        0,
      );

      const locations = Array.from(locationMap.entries()).map(
        ([country, locationData]) => ({
          country,
          count: locationData.users.size,
          percentage:
            totalUniqueLocations > 0
              ? (locationData.users.size / totalUniqueLocations) * 100
              : 0,
          uniqueUsers: locationData.users.size,
        }),
      );

      // Calculate daily logins for the last 7 days
      const dailyLogins = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dateStr = format(date, "yyyy-MM-dd");

        // In a real implementation, you would query for each day
        // For now, we'll create mock data
        dailyLogins.push({
          date: dateStr,
          successful: Math.floor(Math.random() * 100) + 50,
          failed: Math.floor(Math.random() * 20) + 5,
          blocked: Math.floor(Math.random() * 10) + 1,
        });
      }

      // Calculate user verification status
      const verificationStatus = [
        {
          status: "Verified",
          count: verifiedUsers,
          percentage:
            users.length > 0 ? (verifiedUsers / users.length) * 100 : 0,
        },
        {
          status: "Pending",
          count: users.length - verifiedUsers,
          percentage:
            users.length > 0
              ? ((users.length - verifiedUsers) / users.length) * 100
              : 0,
        },
        {
          status: "With Virtual Account",
          count: usersWithVirtualAccounts,
          percentage:
            users.length > 0
              ? (usersWithVirtualAccounts / users.length) * 100
              : 0,
        },
      ];

      setData({
        summary: {
          totalUsers: users.length,
          activeUsersToday,
          newUsersToday,
          totalLoginsToday,
          failedLoginsToday,
          blockedUsers: activeBlockedUsers,
          usersWithVirtualAccounts,
          verifiedUsers,
        },
        users,
        loginLogs,
        blockedLogins,
        devices,
        locations,
        dailyLogins,
        userVerificationStatus: verificationStatus,
      });
    } catch (error: any) {
      console.error("Error fetching analytics data:", error);
      showDialog("Error", "Failed to fetch analytics data", "destructive");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Export functions
  const exportToCSV = (data: any[], filename: string) => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      XLSX.writeFile(workbook, `${filename}.csv`);
      showDialog("Success", "Data exported to CSV successfully");
    } catch (error) {
      showDialog("Export Error", "Failed to export data to CSV", "destructive");
    }
  };

  const exportToExcel = (data: any[], filename: string) => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      showDialog("Success", "Data exported to Excel successfully");
    } catch (error) {
      showDialog(
        "Export Error",
        "Failed to export data to Excel",
        "destructive",
      );
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();

      // Title
      doc.setFontSize(20);
      doc.text("Analytics Dashboard Report", 20, 20);

      // Summary section
      doc.setFontSize(14);
      doc.text("Summary Statistics", 20, 40);

      const summaryData = [
        ["Metric", "Value"],
        ["Total Users", data.summary.totalUsers.toString()],
        ["Active Users Today", data.summary.activeUsersToday.toString()],
        ["New Users Today", data.summary.newUsersToday.toString()],
        ["Total Logins Today", data.summary.totalLoginsToday.toString()],
        ["Failed Logins Today", data.summary.failedLoginsToday.toString()],
        ["Blocked Users", data.summary.blockedUsers.toString()],
        [
          "Users with Virtual Accounts",
          data.summary.usersWithVirtualAccounts.toString(),
        ],
      ];

      (doc as any).autoTable({
        startY: 45,
        head: [summaryData[0]],
        body: summaryData.slice(1),
      });

      // Users section
      let finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(14);
      doc.text("User Overview", 20, finalY);

      (doc as any).autoTable({
        startY: finalY + 5,
        head: [
          [
            "Name",
            "Email",
            "Phone",
            "Country",
            "City",
            "Verification",
            "Virtual Account",
          ],
        ],
        body: data.users.slice(0, 15).map((user) => {
          const location = getUserLocation(user, data.loginLogs);
          const vaInfo = getVirtualAccountInfo(user);
          return [
            user.fullName || `${user.firstName} ${user.lastName}` || "N/A",
            user.email,
            user.phone || "N/A",
            location.country,
            location.city,
            isUserVerified(user) ? "Verified" : "Pending",
            vaInfo ? "Yes" : "No",
          ];
        }),
      });

      doc.save("analytics-report.pdf");
      showDialog("Success", "PDF report generated successfully");
    } catch (error) {
      showDialog(
        "Export Error",
        "Failed to generate PDF report",
        "destructive",
      );
    }
  };

  const exportAllData = (exportFormat: "csv" | "excel" | "pdf") => {
    const exportData = data.users.map((user) => {
      const location = getUserLocation(user, data.loginLogs);
      const vaInfo = getVirtualAccountInfo(user);
      return {
        "User ID": user.id,
        "Full Name":
          user.fullName || `${user.firstName} ${user.lastName}` || "N/A",
        Email: user.email,
        Phone: user.phone || "N/A",
        Country: location.country,
        State: location.state,
        City: location.city,
        "Verification Status": isUserVerified(user) ? "Verified" : "Pending",
        "Virtual Account": vaInfo ? "Yes" : "No",
        "Virtual Account Number": vaInfo?.accountNumber || "N/A",
        "Bank Name": vaInfo?.bankName || "N/A",
        "Account Status": vaInfo?.status || "N/A",
        "Email Verified": user.emailVerified ? "Yes" : "No",
        "Phone Verified": user.phoneVerified ? "Yes" : "No",
        Role: user.role || "User",
        "Created Date": user.createdAt
          ? format(user.createdAt.toDate(), "yyyy-MM-dd")
          : "N/A",
      };
    });

    switch (exportFormat) {
      case "csv":
        exportToCSV(exportData, "users-data");
        break;
      case "excel":
        exportToExcel(exportData, "users-data");
        break;
      case "pdf":
        exportToPDF();
        break;
    }
    setExportDialogOpen(false);
  };

  const tabs = [
    { label: "Overview", icon: Home },
    { label: "Users", icon: Users },
    { label: "Security", icon: Shield },
    { label: "Devices", icon: Smartphone },
    { label: "Locations", icon: MapPin },
    { label: "Login Activity", icon: Calendar },
  ];

  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Users Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mr-4">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Total Users</h3>
            <p className="text-sm text-gray-500">Registered accounts</p>
          </div>
        </div>
        <div className="flex items-baseline">
          <span className="text-3xl font-bold text-gray-900">
            {data.summary.totalUsers.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Active Users Today Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mr-4">
            <User className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Active Today
            </h3>
            <p className="text-sm text-gray-500">Unique users logged in</p>
          </div>
        </div>
        <div className="flex items-baseline">
          <span className="text-3xl font-bold text-gray-900">
            {data.summary.activeUsersToday.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Virtual Accounts Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mr-4">
            <CreditCard className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Virtual Accounts
            </h3>
            <p className="text-sm text-gray-500">Anchor accounts</p>
          </div>
        </div>
        <div className="flex items-baseline">
          <span className="text-3xl font-bold text-gray-900">
            {data.summary.usersWithVirtualAccounts.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Security Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mr-4">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Security</h3>
            <p className="text-sm text-gray-500">Failed/Blocked today</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Failed Logins:</span>
            <span className="font-semibold">
              {data.summary.failedLoginsToday}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Blocked Users:</span>
            <span className="font-semibold">{data.summary.blockedUsers}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLoginActivityChart = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Login Activity (Last 7 Days)
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.dailyLogins}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="successful"
              stroke="#10B981"
              name="Successful"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="failed"
              stroke="#EF4444"
              name="Failed"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="blocked"
              stroke="#F59E0B"
              name="Blocked"
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderUserVerificationChart = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        User Verification Status
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.userVerificationStatus}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry.status}: ${entry.count}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {data.userVerificationStatus.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <RechartsTooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderUserTable = () => {
    const filteredUsers = data.users.filter((user) => {
      if (filters.userStatus !== "all") {
        if (filters.userStatus === "verified") {
          return isUserVerified(user);
        } else if (filters.userStatus === "unverified") {
          return !isUserVerified(user);
        } else if (filters.userStatus === "virtual_account") {
          return hasVirtualAccount(user);
        }
      }
      if (filters.country !== "all") {
        const location = getUserLocation(user, data.loginLogs);
        return location.country === filters.country;
      }
      return true;
    });

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            User Directory
          </h3>
          <span className="text-sm text-gray-500">
            {filteredUsers.length} users
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verification
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Virtual Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.slice(0, 20).map((user) => {
                const location = getUserLocation(user, data.loginLogs);
                const vaInfo = getVirtualAccountInfo(user);

                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {user.fullName ||
                              `${user.firstName} ${user.lastName}` ||
                              "N/A"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.role || "User"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-900">
                          <Mail className="w-4 h-4 mr-2 text-gray-400" />
                          {user.email}
                        </div>
                        {user.phone && (
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="w-4 h-4 mr-2 text-gray-400" />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-900">
                          <MapIcon className="w-4 h-4 mr-2 text-gray-400" />
                          {location.country}
                        </div>
                        <div className="text-sm text-gray-500">
                          {location.city || "N/A"}, {location.state || "N/A"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isUserVerified(user) ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Clock className="w-4 h-4 mr-1" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {vaInfo ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-900">
                            {vaInfo.accountNumber}
                          </div>
                          <div className="text-xs text-gray-500">
                            {vaInfo.bankName || "Bank"}
                          </div>
                          <div className="text-xs">
                            <span
                              className={`px-2 py-1 rounded-full ${
                                vaInfo.status === "ACTIVE"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {vaInfo.status || "Unknown"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">
                          No account
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.bridgeCard?.is_active ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSecurityTable = () => {
    const filteredLogs = data.loginLogs.filter((log) => {
      if (filters.loginStatus !== "all") {
        if (filters.loginStatus === "success") return log.success;
        if (filters.loginStatus === "failed") return !log.success;
      }
      return true;
    });

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Security Logs (Today)
          </h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {filteredLogs.length} logs
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Network
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLogs.slice(0, 15).map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {log.email}
                  </td>
                  <td className="px-6 py-4">
                    {log.success ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {log.deviceInfo?.device || "Unknown"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {log.deviceInfo?.os || "Unknown OS"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {log.location?.city || "Unknown"},{" "}
                      {log.location?.country || "Unknown"}
                    </div>
                    <div className="text-xs text-gray-500">{log.ip}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {log.networkType}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {log.timestamp
                      ? format(log.timestamp.toDate(), "HH:mm:ss")
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {log.errorMessage || "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderBlockedUsersTable = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Blocked Users</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Failed Attempts
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                First Failed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Failed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Blocked Until
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.blockedLogins.slice(0, 15).map((block) => {
              const isActive =
                block.blockedUntil && block.blockedUntil.toDate() > new Date();
              return (
                <tr key={block.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {block.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {block.failedAttempts}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {block.firstFailedAt
                      ? format(block.firstFailedAt.toDate(), "MMM dd, HH:mm")
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {block.lastFailedAt
                      ? format(block.lastFailedAt.toDate(), "MMM dd, HH:mm")
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {block.blockedUntil
                      ? format(block.blockedUntil.toDate(), "MMM dd, HH:mm")
                      : "N/A"}
                  </td>
                  <td className="px-6 py-4">
                    {isActive ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <Lock className="w-4 h-4 mr-1" />
                        Blocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Unblocked
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderFilterDialog = () => (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${filterDialogOpen ? "" : "hidden"}`}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setFilterDialogOpen(false)}
      />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Filter Analytics Data
            </h3>
            <button
              onClick={resetFilters}
              className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              Reset All
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <DatePicker
              selected={filters.dateRange[0]}
              onChange={(dates: [Date | null, Date | null] | null) => {
                if (dates) {
                  handleFilterChange("dateRange", dates);
                }
              }}
              startDate={filters.dateRange[0]}
              endDate={filters.dateRange[1]}
              selectsRange
              inline
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User Status
              </label>
              <select
                value={filters.userStatus}
                onChange={(e) =>
                  handleFilterChange("userStatus", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Users</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
                <option value="virtual_account">With Virtual Account</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <select
                value={filters.country}
                onChange={(e) => handleFilterChange("country", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Countries</option>
                {Array.from(
                  new Set(
                    data.users
                      .map(
                        (user) => getUserLocation(user, data.loginLogs).country,
                      )
                      .filter(Boolean),
                  ),
                ).map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Login Status
              </label>
              <select
                value={filters.loginStatus}
                onChange={(e) =>
                  handleFilterChange("loginStatus", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Logs</option>
                <option value="success">Successful Only</option>
                <option value="failed">Failed Only</option>
              </select>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setFilterDialogOpen(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => setFilterDialogOpen(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderExportDialog = () => (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${exportDialogOpen ? "" : "hidden"}`}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setExportDialogOpen(false)}
      />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Export Data
        </h3>
        <p className="text-sm text-gray-600 mb-6">Select export format:</p>
        <div className="space-y-3">
          <button
            onClick={() => exportAllData("csv")}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-5 h-5 mr-2" />
            Export Users as CSV
          </button>
          <button
            onClick={() => exportAllData("excel")}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-5 h-5 mr-2" />
            Export Users as Excel
          </button>
          <button
            onClick={() => exportAllData("pdf")}
            className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-5 h-5 mr-2" />
            Export Full Report as PDF
          </button>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setExportDialogOpen(false)}
            className="px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const renderDeviceChart = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Device Distribution (Unique Users)
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.devices}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry.device}: ${entry.uniqueUsers}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="uniqueUsers"
            >
              {data.devices.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <RechartsTooltip
              formatter={(value) => [`${value} unique users`, "Count"]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderLocationChart = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        User Locations (Unique Users)
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.locations.slice(0, 10)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="country" />
            <YAxis />
            <RechartsTooltip
              formatter={(value) => [`${value} unique users`, "Count"]}
            />
            <Bar dataKey="uniqueUsers" fill="#00C49F" name="Unique Users" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            Analytics Dashboard
          </h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">
            Real-time insights from your Firestore data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAnalyticsData}
            disabled={loading}
            className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw
              className={`w-5 h-5 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => setFilterDialogOpen(true)}
            className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Filter Data"
          >
            <Filter className="w-5 h-5 mr-2" />
            Filters
          </button>
          <button
            onClick={() => setExportDialogOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            title="Export Data"
          >
            <Download className="w-5 h-5 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex overflow-x-auto">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <button
                key={index}
                onClick={() => setTabValue(index)}
                className={`flex items-center px-6 py-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                  tabValue === index
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
            {format(filters.dateRange[0], "MMM dd")} -{" "}
            {format(filters.dateRange[1], "MMM dd")}
            <button
              onClick={() =>
                handleFilterChange("dateRange", [
                  subDays(new Date(), 30),
                  new Date(),
                ])
              }
              className="ml-2 hover:text-blue-600"
            >
              ×
            </button>
          </span>
          {filters.userStatus !== "all" && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
              Status: {filters.userStatus}
              <button
                onClick={() => handleFilterChange("userStatus", "all")}
                className="ml-2 hover:text-green-600"
              >
                ×
              </button>
            </span>
          )}
          {filters.country !== "all" && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800">
              Country: {filters.country}
              <button
                onClick={() => handleFilterChange("country", "all")}
                className="ml-2 hover:text-purple-600"
              >
                ×
              </button>
            </span>
          )}
          <button
            onClick={() => setFilterDialogOpen(true)}
            className="text-sm text-blue-600 hover:text-blue-700 ml-2"
          >
            Edit Filters
          </button>
        </div>
      </div>

      {/* Main Content */}
      {tabValue === 0 && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {renderSummaryCards()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>{renderLoginActivityChart()}</div>
            <div>{renderUserVerificationChart()}</div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>{renderDeviceChart()}</div>
            <div>{renderLocationChart()}</div>
          </div>
        </div>
      )}

      {tabValue === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                User Statistics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Users:</span>
                  <span className="font-semibold text-gray-900">
                    {data.summary.totalUsers}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Verified Users:</span>
                  <span className="font-semibold text-gray-900">
                    {data.summary.verifiedUsers}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    With Virtual Accounts:
                  </span>
                  <span className="font-semibold text-gray-900">
                    {data.summary.usersWithVirtualAccounts}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Active Today:</span>
                  <span className="font-semibold text-gray-900">
                    {data.summary.activeUsersToday}
                  </span>
                </div>
              </div>
            </div>

            {/* Location Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Top Countries (Unique Users)
              </h3>
              <div className="space-y-3">
                {data.locations.slice(0, 5).map((location) => (
                  <div
                    key={location.country}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">
                        {location.country}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-600">
                        {location.uniqueUsers} users
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {location.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {renderUserTable()}
        </div>
      )}

      {tabValue === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Security Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Security Overview
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Total Logins Today:
                  </span>
                  <span className="font-semibold text-gray-900">
                    {data.summary.totalLoginsToday}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Failed Logins Today:
                  </span>
                  <span className="font-semibold text-gray-900">
                    {data.summary.failedLoginsToday}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Currently Blocked:
                  </span>
                  <span className="font-semibold text-gray-900">
                    {data.summary.blockedUsers}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Success Rate:</span>
                  <span className="font-semibold text-green-600">
                    {data.summary.totalLoginsToday > 0
                      ? (
                          ((data.summary.totalLoginsToday -
                            data.summary.failedLoginsToday) /
                            data.summary.totalLoginsToday) *
                          100
                        ).toFixed(1)
                      : "0"}
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Login Status Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Login Status Distribution
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: "Successful",
                          value:
                            data.summary.totalLoginsToday -
                            data.summary.failedLoginsToday,
                        },
                        {
                          name: "Failed",
                          value: data.summary.failedLoginsToday,
                        },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) => `${entry.name}: ${entry.value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#10B981" />
                      <Cell fill="#EF4444" />
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {renderBlockedUsersTable()}
          {renderSecurityTable()}
        </div>
      )}

      {tabValue === 3 && (
        <div className="space-y-6">
          {renderDeviceChart()}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Device Details (Unique Users)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Logins
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unique Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.devices.map((device, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {device.device}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {device.count}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {device.uniqueUsers}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {device.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tabValue === 4 && (
        <div className="space-y-6">
          {renderLocationChart()}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              Location Details (Unique Users)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Country
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unique Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sample City
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.locations.slice(0, 10).map((location, index) => {
                    const sampleUser = data.users.find((user) => {
                      const userLocation = getUserLocation(
                        user,
                        data.loginLogs,
                      );
                      return userLocation.country === location.country;
                    });

                    const sampleCity = sampleUser
                      ? getUserLocation(sampleUser, data.loginLogs).city
                      : "Unknown";

                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {location.country}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {location.uniqueUsers}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {location.percentage.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {sampleCity}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tabValue === 5 && (
        <div className="space-y-6">
          {renderLoginActivityChart()}
          {renderSecurityTable()}
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm text-gray-500">
            Data last updated: {format(new Date(), "yyyy-MM-dd HH:mm:ss")}
          </div>
          <button
            onClick={() => setExportDialogOpen(true)}
            className="flex items-center justify-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-5 h-5 mr-2" />
            Export Full Report
          </button>
        </div>
      </div>

      {/* Dialogs */}
      {renderFilterDialog()}
      {renderExportDialog()}
      <Dialog
        open={dialogOpen}
        title={dialogTitle}
        message={dialogMessage}
        variant={dialogVariant}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
};

export default AnalyticsDashboard;
