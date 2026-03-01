"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  ExternalLink,
  Loader,
  Users,
  DollarSign,
  TrendingUp,
  Copy,
  CheckCircle,
  Edit2,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "@/lib/types";
import { ExportMenu } from "@/components/ExportMenu";
import { Pagination } from "@/components/Pagination";
import { EmptyState } from "@/components/EmptyState";

interface ReferralStats {
  totalReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
}

interface ReferralUser extends User {
  referredBy?: string;
  referralCount: number;
  referralEarnings: number;
  userName?: string;
}

export default function ReferralsAdminPage() {
  const [users, setUsers] = useState<ReferralUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<ReferralUser | null>(null);
  const [referralBonus, setReferralBonus] = useState<number>(500); // Default ₦500 per referral
  const [updatingBonus, setUpdatingBonus] = useState(false);
  const [globalStats, setGlobalStats] = useState<ReferralStats>({
    totalReferrals: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
  });
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedCode, setCopiedCode] = useState<string>("");
  const [minTransactionAmount, setMinTransactionAmount] = useState<number>(0);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(true);

  // New states for editing earnings
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newEarnings, setNewEarnings] = useState<number>(0);
  const [savingEarnings, setSavingEarnings] = useState(false);

  // Load referral settings from Firestore
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setSettingsLoading(true);
        const settingsDoc = await getDoc(doc(db, "settings", "referrals"));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (typeof data.bonusPerReferral === "number") {
            setReferralBonus(data.bonusPerReferral);
          }
          if (typeof data.minTransactionAmount === "number") {
            setMinTransactionAmount(data.minTransactionAmount);
          }
        }
      } catch (err) {
        console.error("Failed to load referral settings", err);
      } finally {
        setSettingsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Fetch all users with referral data
  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        setLoading(true);

        const usersSnapshot = await getDocs(
          query(collection(db, "users"), orderBy("createdAt", "desc")),
        );
        const usersData: ReferralUser[] = [];

        let totalRefs = 0;
        let totalEarned = 0;

        for (const userDoc of usersSnapshot.docs) {
          const data = userDoc.data();
          const uid = userDoc.id;

          // Get referrals array length
          const referrals = (data.referrals as string[]) || [];
          const referralCount = referrals.length;

          // Use stored custom earnings if exists, otherwise calculate
          const customEarnings = data.customReferralEarnings as
            | number
            | undefined;
          const earningsPerReferral = data.referralBonus || referralBonus;
          const calculatedEarnings = referralCount * earningsPerReferral;
          const referralEarnings = customEarnings ?? calculatedEarnings;

          usersData.push({
            id: uid,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email || "",
            phone: data.phone || "",
            userName: data.userName || "",
            createdAt: data.createdAt?.toDate() || new Date(),
            referralCount,
            referralEarnings,
            referredBy: data.referredBy || undefined,
          });

          totalRefs += referralCount;
          totalEarned += referralEarnings;
        }

        setUsers(usersData);
        setGlobalStats({
          totalReferrals: totalRefs,
          totalEarnings: totalEarned,
          pendingEarnings: 0,
        });
      } catch (err) {
        console.error("Failed to load referral data", err);
        setError("Failed to load referral data");
      } finally {
        setLoading(false);
      }
    };

    fetchReferralData();
  }, [referralBonus]);

  // Save referral settings to Firestore
  const updateReferralBonus = async () => {
    if (updatingBonus) return;

    try {
      setUpdatingBonus(true);
      await setDoc(
        doc(db, "settings", "referrals"),
        {
          bonusPerReferral: referralBonus,
          minTransactionAmount,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      console.error("Failed to update referral settings", err);
      alert("Failed to save settings");
    } finally {
      setUpdatingBonus(false);
    }
  };

  const copyReferralCode = (code: string) => {
    navigator.clipboard.writeText(code.toLowerCase());
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  // Start editing earnings for a user
  const startEditEarnings = (user: ReferralUser) => {
    setEditingUserId(user.id);
    setNewEarnings(user.referralEarnings);
  };

  // Cancel editing
  const cancelEditEarnings = () => {
    setEditingUserId(null);
    setNewEarnings(0);
  };

  // Save custom earnings to Firestore
  const saveCustomEarnings = async (userId: string) => {
    if (savingEarnings) return;

    try {
      setSavingEarnings(true);
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        customReferralEarnings: newEarnings,
        updatedAt: serverTimestamp(),
      });

      // Update local state
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, referralEarnings: newEarnings } : u,
        ),
      );

      // Update global stats
      setGlobalStats((prev) => ({
        ...prev,
        totalEarnings:
          prev.totalEarnings +
          (newEarnings -
            (users.find((u) => u.id === userId)?.referralEarnings ?? 0)),
      }));

      setEditingUserId(null);
    } catch (err) {
      console.error("Failed to update earnings", err);
      alert("Failed to save earnings");
    } finally {
      setSavingEarnings(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const search = searchTerm.toLowerCase();
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      return (
        fullName.includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        user.phone?.includes(search) ||
        user.userName?.toLowerCase().includes(search)
      );
    });
  }, [users, searchTerm]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Referrals Management
          </h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">
            Manage referral program, view stats, and adjust rewards
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Referrals</p>
              <p className="text-3xl font-bold mt-2">
                {globalStats.totalReferrals}
              </p>
            </div>
            <Users className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Total Earnings Paid</p>
              <p className="text-3xl font-bold mt-2">
                ₦{globalStats.totalEarnings.toLocaleString()}
              </p>
            </div>
            <DollarSign className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <p className="text-purple-100 font-medium">Referral Settings</p>
              {settingsLoading ? (
                <div className="flex items-center gap-2 text-purple-200">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-purple-200">Bonus per Referral (₦)</label>
                    <input
                      type="number"
                      value={referralBonus}
                      onChange={(e) => setReferralBonus(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                      placeholder="e.g. 500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-purple-200">Min. Transaction for Referee to Qualify (₦)</label>
                    <input
                      type="number"
                      value={minTransactionAmount}
                      onChange={(e) => setMinTransactionAmount(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 bg-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                      placeholder="e.g. 1000"
                    />
                  </div>
                  <button
                    onClick={updateReferralBonus}
                    disabled={updatingBonus}
                    className="w-full px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-white/90 transition"
                  >
                    {updatingBonus ? "Saving..." : "Save Settings"}
                  </button>
                </>
              )}
            </div>
            <TrendingUp className="w-10 h-10 opacity-80 mt-1 shrink-0" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by name, email, phone, or username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <ExportMenu
          data={users.map((u) => ({
            userId: u.id,
            name: `${u.firstName} ${u.lastName}`,
            username: u.userName,
            email: u.email,
            phone: u.phone,
            referralCount: u.referralCount,
            earnings: u.referralEarnings,
           joined: u.createdAt?.toISOString() ?? '',
          }))}
          filenameBase="referrals"
          title="Referrals Export"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={<Users className="w-12 h-12" />}
            title="No users found"
            description="No users with referrals yet"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referral Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referrals
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Earnings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {user.email || user.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono px-2 py-1 rounded">
                            {user.userName?.toUpperCase() || "N/A"}
                          </code>
                          <button
                            onClick={() =>
                              copyReferralCode(user.userName || "")
                            }
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {copiedCode === user.userName ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.referralCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingUserId === user.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={newEarnings}
                              onChange={(e) =>
                                setNewEarnings(Number(e.target.value))
                              }
                              className="w-32 px-3 py-1 border border-gray-300 rounded text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => saveCustomEarnings(user.id)}
                              disabled={savingEarnings}
                              className="text-green-600 hover:text-green-800"
                            >
                              {savingEarnings ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={cancelEditEarnings}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-green-600">
                              ₦{user.referralEarnings.toLocaleString()}
                            </span>
                            <button
                              onClick={() => startEditEarnings(user)}
                              className="ml-4 text-gray-500 hover:text-gray-700"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.createdAt?.toLocaleDateString()??''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                    <option value="50">50</option>
                  </select>
                </label>
                <span className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * pageSize + 1}-
                  {Math.min(currentPage * pageSize, filteredUsers.length)} of{" "}
                  {filteredUsers.length}
                </span>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </>
        )}
      </div>

      {/* User Referral Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedUser(null)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedUser.firstName} {selectedUser.lastName}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Referral Performance
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center p-6 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600">Referral Code</p>
                  <p className="text-2xl font-bold text-blue-900 mt-2">
                    {selectedUser.userName?.toUpperCase()}
                  </p>
                </div>
                <div className="text-center p-6 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600">Total Referrals</p>
                  <p className="text-2xl font-bold text-green-900 mt-2">
                    {selectedUser.referralCount}
                  </p>
                </div>
                <div className="text-center p-6 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600">Total Earnings</p>
                  <p className="text-2xl font-bold text-purple-900 mt-2">
                    ₦{selectedUser.referralEarnings.toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Users Referred by {selectedUser.firstName}
                </h3>
                <ReferredUsersList referrerId={selectedUser.id} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component to list users referred by a specific user
function ReferredUsersList({ referrerId }: { referrerId: string }) {
  const [referred, setReferred] = useState<ReferralUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReferred = async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("referredBy", "==", referrerId),
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email || "",
            phone: data.phone || "",
            userName: data.userName || "",
            createdAt: data.createdAt?.toDate() || new Date(),
            referralCount: 0,
            referralEarnings: 0,
          } as ReferralUser;
        });
        setReferred(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchReferred();
  }, [referrerId]);

  if (loading)
    return (
      <div className="text-center py-8">
        <Loader className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );

  if (referred.length === 0)
    return (
      <p className="text-center text-gray-500 py-8">No users referred yet</p>
    );

  return (
    <div className="space-y-3">
      {referred.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-sm font-medium">
                {user.userName?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-gray-500">@{user.userName}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              Joined {user.createdAt?.toLocaleDateString() ?? ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
