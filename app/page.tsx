"use client";
import { getBusinesses } from "@/lib/firestore"; // Add this import
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Receipt,
  Calendar,
  Loader,
  Copy,
  ArrowRightLeft,
} from "lucide-react";
import StatsCard from "@/components/StatsCard";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonGrid } from "@/components/Skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getTransactions, getUsers } from "@/lib/firestore";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type AccountBalanceResp = {
  data?: {
    availableBalance?: number;
    ledgerBalance?: number;
    hold?: number;
    pending?: number;
  };
};

// Add fetchAccountBalance function at the top with your other imports
const fetchAccountBalance = httpsCallable<
  { accountId: string },
  { data: { availableBalance: number; currency: string } }
>(functions, "fetchAccountBalance");

// Add this helper function to get account ID
const getAccountId = (entity: User | Business): string | null => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (entity.getAnchorData as any)?.virtualAccount?.data?.id || null;
};

/** Return a random realistic NGN balance for mock entities (avoids hitting real Anchor API) */
const mockBalance = (): number =>
  Math.floor(Math.random() * 490000 + 10000);
import { Business, Transaction, User } from "@/lib/types";
import { useDemoMode } from "@/lib/demo";

type DatePeriod = "today" | "week" | "month" | "year";
type RawTxn = Record<string, unknown>;

const getCurrencySymbol = (currency?: string): string => {
  if (!currency) return "₦"; // Default to Naira

  const currencyLower = currency.toLowerCase();
  if (currencyLower.includes("usd") || currencyLower.includes("dollar"))
    return "$";
  if (currencyLower.includes("eur") || currencyLower.includes("euro"))
    return "€";
  if (currencyLower.includes("gbp") || currencyLower.includes("pound"))
    return "£";
  if (currencyLower.includes("ngn") || currencyLower.includes("naira"))
    return "₦";

  return "₦"; // Default fallback
};

const formatAmount = (amount: number, currency?: string): string => {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${Number(amount || 0).toLocaleString()}`;
};

const formatTransactionType = (type?: string): string => {
  if (!type) return "N/A";
  const typeLower = type.toLowerCase();
  if (typeLower === "fund") return "Card Funding";
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const pickString = (obj: RawTxn, ...keys: string[]) => {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim().length) return v;
  }
  return undefined;
};

const pickNumber = (obj: RawTxn, ...keys: string[]) => {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v)))
      return Number(v);
  }
  return undefined;
};

const pickDate = (obj: RawTxn, ...keys: string[]) => {
  for (const key of keys) {
    const v = obj[key] as any;
    if (v?.toDate) return v.toDate();
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return undefined;
};

export default function DashboardPage() {
  const demoMode = useDemoMode();
  const mockOpts = demoMode ? { mock: true } : undefined;
  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>("week");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Company account balance and transfer details
  const [companyBalance, setCompanyBalance] = useState<{
    availableBalance: number;
    ledgerBalance: number;
    hold: number;
    pending: number;
  } | null>(null);
  const [companyTransfer, setCompanyTransfer] = useState<{
    accountNumber?: string;
    bankName?: string;
  } | null>(null);
  const [companyLoading, setCompanyLoading] = useState<boolean>(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [txns, usersData, bizData] = await Promise.all([
          getTransactions(mockOpts),
          getUsers(mockOpts),
          getBusinesses(mockOpts),
        ]);

        const userMap = new Map(usersData.map((u) => [u.id, u]));
        const normalized = txns.map((t) => {
          const raw: RawTxn = t as RawTxn;
          const user = userMap.get(pickString(raw, "userId", "user_id") || "");

          const parsedDate = pickDate(raw, "timestamp", "date", "createdAt");
          const amount = pickNumber(raw, "amount") ?? 0;
          const type = pickString(raw, "type") || "unknown";
          const nestedApiStatus = (raw as any)?.api_response?.data?.attributes
            ?.status;
          const nestedFullDataStatus = (raw as any)?.fullData?.status;
          const nestedDetailStatus = (raw as any)?.detail?.status;
          const statusSource =
            pickString(raw, "status") ||
            (typeof nestedApiStatus === "string"
              ? nestedApiStatus
              : undefined) ||
            (typeof nestedFullDataStatus === "string"
              ? nestedFullDataStatus
              : undefined) ||
            (typeof nestedDetailStatus === "string"
              ? nestedDetailStatus
              : undefined) ||
            "unknown";
          const status = statusSource.toLowerCase();
          const reference =
            pickString(raw, "reference", "transaction_reference", "id") || t.id;
          const currency = pickString(
            raw,
            "currency",
            "currencyCode",
            "currency_code",
          );

          return {
            ...t,
            id: t.id || reference,
            userName: user
              ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                user.email ||
                user.phone
              : pickString(raw, "userName"),
            date: parsedDate,
            amount,
            type,
            status: status as Transaction["status"],
            reference,
            currency,
          } as Transaction;
        });

        setTransactions(normalized);
        setUsers(usersData);
        setBusinesses(bizData);

        // Fetch company account details and balance
        try {
          const accountRef = doc(db, "company", "account_details");
          const accountSnap = await getDoc(accountRef);
          console.log(
            "company/account_details exists:",
            accountSnap.exists(),
            "data:",
            accountSnap.exists() ? accountSnap.data() : null,
          );
          if (accountSnap.exists()) {
            const acctData = accountSnap.data() as Record<string, any>;
            const accountId = acctData?.accountId || acctData?.account_id;
            const accountNumber =
              acctData?.accountNumber || acctData?.account_number;
            const bankName =
              acctData?.bankName || acctData?.bank_name || acctData?.bank;

            console.log("company account doc", {
              accountId,
              accountNumber,
              bankName,
            });

            setCompanyTransfer({ accountNumber, bankName });

            if (accountId && !demoMode) {
              setCompanyLoading(true);
              setCompanyError(null);
              try {
                // SECURITY: Use the Firebase callable (fetchAccountBalance) rather than
                // the raw HTTP endpoint (fetchAccountBalanceHttp). The callable automatically
                // attaches the Firebase Auth ID token, so the function can verify the caller.
                // The HTTP endpoint requires a separate Bearer token and should only be
                // called by server-side internal services, not browser clients.
                const resp = await fetchAccountBalance({ accountId: String(accountId) });
                const d = (resp?.data as any)?.data;
                if (d) {
                  setCompanyBalance({
                    availableBalance: Number(d.availableBalance || 0),
                    ledgerBalance: Number(d.ledgerBalance || 0),
                    hold: Number(d.hold || 0),
                    pending: Number(d.pending || 0),
                  });
                } else {
                  setCompanyError("No balance data");
                }
              } catch (err) {
                console.error("Failed to fetch account balance (HTTP)", err);
                setCompanyError("Error fetching balance");
              } finally {
                setCompanyLoading(false);
              }
            } else if (acctData?.availableBalance != null) {
              // Balance stored directly in the doc (seeded mock account)
              setCompanyBalance({
                availableBalance: Number(acctData.availableBalance),
                ledgerBalance: Number(acctData.ledgerBalance || acctData.availableBalance),
                hold: Number(acctData.hold || 0),
                pending: Number(acctData.pending || 0),
              });
            } else {
              setCompanyError("Missing accountId");
            }
          } else {
            console.warn("company/account_details does not exist");
            setCompanyError("No account details");
          }
        } catch (err) {
          console.error("Failed to load company account details", err);
          setCompanyError("Failed to load account details");
        }

        setError(null);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const periodLabels = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    year: "This Year",
  };

  const filteredByPeriod = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (selectedPeriod === "today") start.setHours(0, 0, 0, 0);
    if (selectedPeriod === "week") start.setDate(now.getDate() - 7);
    if (selectedPeriod === "month") start.setMonth(now.getMonth() - 1);
    if (selectedPeriod === "year") start.setFullYear(now.getFullYear() - 1);
    return transactions.filter((t) => {
      const d = t.date ? new Date(t.date) : undefined;
      return d ? d >= start : false;
    });
  }, [transactions, selectedPeriod]);
  const stats = useMemo(() => {
    const deposits = filteredByPeriod
      .filter(
        (t) =>
          t.type === "deposit" &&
          (t.status === "success" || t.status === "successful"),
      )
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const withdrawals = filteredByPeriod
      .filter(
        (t) =>
          t.type === "withdrawal" &&
          (t.status === "success" || t.status === "successful"),
      )
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const transfers = filteredByPeriod
      .filter(
        (t) =>
          t.type === "transfer" &&
          (t.status === "success" || t.status === "successful"),
      )
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const pendingWithdrawals = filteredByPeriod
      .filter((t) => t.type === "withdrawal" && t.status === "pending")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    return {
      balance: deposits - withdrawals,
      deposits,
      withdrawals,
      transfers,
      pendingWithdrawals,
      users: users.length + businesses.length,
      transactions: filteredByPeriod.length,
    };
  }, [filteredByPeriod, users.length, businesses.length]);

  const weeklyData = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      return d;
    });

    return days.map((day) => {
      const total = transactions
        .filter((t) => {
          const d = t.date ? new Date(t.date) : undefined;
          return d && d.toDateString() === day.toDateString();
        })
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const label = day.toLocaleDateString(undefined, { weekday: "short" });
      return { day: label, amount: total };
    });
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => {
      const ad = a.date ? new Date(a.date).getTime() : 0;
      const bd = b.date ? new Date(b.date).getTime() : 0;
      return bd - ad;
    });

    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize).map((t) => ({
      id: t.id,
      user: t.userName || t.userId || "Unknown",
      type: t.type,
      amount: Number(t.amount) || 0,
      status: t.status,
      date: t.date ? new Date(t.date).toLocaleString() : "N/A",
      currency: (t as any).currency,
    }));
  }, [transactions, pageSize, currentPage]);

  const totalTransactions = transactions.length;
  const totalPages = Math.ceil(totalTransactions / pageSize);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1">
            Welcome back! Here&apos;s what&apos;s happening.
          </p>
        </div>

        {/* Date Period Filter */}
        <div className="flex items-center gap-1 sm:gap-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 overflow-x-auto">
          <Calendar className="w-4 h-4 text-gray-400 ml-1 sm:ml-2 flex-shrink-0" />
          {(["today", "week", "month", "year"] as DatePeriod[]).map(
            (period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  selectedPeriod === period
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {periodLabels[period]}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <SkeletonGrid count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <StatsCard
            title="Total Assets (₦)"
            value={loading ? "..." : `₦${stats.balance.toLocaleString()}`}
            icon={<Wallet className="w-6 h-6" />}
            trend={{ value: 12.5, isPositive: true }}
          />
          <StatsCard
            title="Total Transactions"
            value={loading ? "..." : stats.transactions}
            icon={<Wallet className="w-6 h-6" />}
            trend={{ value: 12.5, isPositive: true }}
          />
          {/* Company Wallet Balance Card */}
          <StatsCard
            title="Company Wallet"
            value={
              loading || companyLoading
                ? "Loading..."
                : companyBalance
                  ? formatAmount(companyBalance.availableBalance / 100)
                  : companyError
                    ? "Error"
                    : "N/A"
            }
            icon={<Wallet className="w-6 h-6" />}
            subtitle={
              companyTransfer ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>
                    {companyTransfer.bankName || ""}
                    {companyTransfer.bankName && companyTransfer.accountNumber
                      ? " • "
                      : ""}
                  </span>
                  <span className="font-mono">
                    {companyTransfer.accountNumber || ""}
                  </span>
                  {companyTransfer.accountNumber && (
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(
                            String(companyTransfer.accountNumber),
                          );
                          setCopiedAccount(true);
                          setTimeout(() => setCopiedAccount(false), 2000);
                          console.log("Copied account number to clipboard");
                        } catch (err) {
                          console.error("Failed to copy account number", err);
                        }
                      }}
                      className="ml-1 text-gray-400 hover:text-gray-600"
                      aria-label="Copy account number"
                      type="button"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                  {copiedAccount && (
                    <span className="text-xs text-green-600 ml-2">Copied</span>
                  )}
                  {companyError && (
                    <span className="text-xs text-red-600 ml-2">
                      {companyError}
                    </span>
                  )}
                </div>
              ) : (
                <span>{loading ? "..." : "No account"}</span>
              )
            }
          />
          <StatsCard
            title="Total Deposits"
            value={loading ? "..." : `₦${stats.deposits.toLocaleString()}`}
            icon={<TrendingUp className="w-6 h-6" />}
            trend={{ value: 8.3, isPositive: true }}
          />
          <StatsCard
            title="Total Withdrawals"
            value={loading ? "..." : `₦${stats.withdrawals.toLocaleString()}`}
            icon={<TrendingDown className="w-6 h-6" />}
            trend={{ value: 3.2, isPositive: false }}
          />
          <StatsCard
            title="Total Transfers"
            value={loading ? "..." : `₦${stats.transfers.toLocaleString()}`}
            icon={<ArrowRightLeft className="w-6 h-6" />}
            subtitle={`${periodLabels[selectedPeriod]}`}
          />
          <StatsCard
            title="Pending Withdrawals"
            value={
              loading ? "..." : `₦${stats.pendingWithdrawals.toLocaleString()}`
            }
            icon={<Clock className="w-6 h-6" />}
            subtitle={`${periodLabels[selectedPeriod]}`}
          />
          <StatsCard
            title="Total Users"
            value={loading ? "..." : stats.users}
            icon={<Users className="w-6 h-6" />}
            trend={{ value: 15.8, isPositive: true }}
          />
          <StatsCard
            title="Transactions"
            value={loading ? "..." : stats.transactions}
            icon={<Receipt className="w-6 h-6" />}
            subtitle={`${periodLabels[selectedPeriod]}`}
          />
        </div>
      )}

      {/* Weekly Activity Chart */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Weekly Activity
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="day" stroke="#9ca3af" />
            <YAxis
              stroke="#9ca3af"
              tickFormatter={(value: number) => `₦${value.toLocaleString()}`}
            />
           <Tooltip
  formatter={(value) => [
    `₦${Number(value).toLocaleString()}`,
    "Amount",
  ]}
  contentStyle={{
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  }}
/>

            <Line
              type="monotone"
              dataKey="amount"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Transactions
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentTransactions.map((transaction) => (
                <tr
                  key={transaction.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {transaction.user}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatTransactionType(transaction.type)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatAmount(transaction.amount, transaction.currency)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.status === "success" ||
                        transaction.status === "successful"
                          ? "bg-green-100 text-green-800"
                          : transaction.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.date}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
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
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
              </select>
            </label>
            <span className="text-sm text-gray-600">
              Showing{" "}
              {Math.min((currentPage - 1) * pageSize + 1, totalTransactions)}-
              {Math.min(currentPage * pageSize, totalTransactions)} of{" "}
              {totalTransactions}
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
      </div>
    </div>
  );
}
