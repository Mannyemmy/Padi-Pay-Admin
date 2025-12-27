'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, X, User as UserIcon, FileText, Trash2 } from 'lucide-react';
import { User, Referral } from '@/lib/types';
import { getUsers, setUserRole, getReferralsByReferrer, getUser, sendUserNotification, getTransactionStatsByUser } from '@/lib/firestore';
import { useAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { showToast } from '@/components/Toast';
import { ExportMenu } from '@/components/ExportMenu';

export default function AgentsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectAllInModal, setSelectAllInModal] = useState(false);
  const [showReferralsFor, setShowReferralsFor] = useState<User | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralTxStats, setReferralTxStats] = useState<Record<string, { total: number; count: number }>>({});
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [selectedReferredUser, setSelectedReferredUser] = useState<User | null>(null);
  const [showReferredUserProfile, setShowReferredUserProfile] = useState(false);

  // Agent filters & sorting (moved here so hooks are always called in same order)
  const [sortBy, setSortBy] = useState<'mostReferrals' | 'mostTransactingCustomers' | 'highestReferralVolume' | 'newest' | 'oldest'>('mostReferrals');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [agentStats, setAgentStats] = useState<Record<string, { referralCount: number; transactingCustomers: number; referralVolume: number }>>({});

  // Agent derived data and stats
  const agents = users.filter((u) => u.role === 'agent');

  const computeAgentStats = async (agentList: User[]) => {
    const entries = await Promise.all(agentList.map(async (a) => {
      try {
        const refs = await getReferralsByReferrer(a.id);
        const referralCount = refs.length;
        let transactingCustomers = 0;
        let referralVolume = 0;

        await Promise.all(refs.map(async (r) => {
          try {
            const stats = await getTransactionStatsByUser(r.referredUid);
            if (stats.count > 0) transactingCustomers += 1;
            referralVolume += stats.total;
          } catch {
            // ignore per referred user errors
          }
        }));

        return [a.id, { referralCount, transactingCustomers, referralVolume }] as const;
      } catch {
        return [a.id, { referralCount: 0, transactingCustomers: 0, referralVolume: 0 }] as const;
      }
    }));

    setAgentStats(Object.fromEntries(entries));
  };

  useEffect(() => {
    // Compute stats for agents when agents list changes
    if (agents.length > 0) {
      computeAgentStats(agents);
    }
  }, [agents]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
      showToast('error', 'Load failed', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const router = useRouter();

  useEffect(() => {
    loadUsers();
  }, []);

  const { admin, loading: authLoading } = useAuth();

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[300px]"><Loading /></div>;
  }

  if (!admin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Role not assigned</p>
          <p className="text-sm text-gray-500">Your account has an admin profile but no role assigned. Please contact a super-admin to assign a role.</p>
        </div>
      </div>
    );
  }

  if (admin.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Access denied</p>
          <p className="text-sm text-gray-500">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }



  const loadReferrals = async (user: User) => {
    try {
      setShowReferralsFor(user);
      setLoadingReferrals(true);
      const data = await getReferralsByReferrer(user.id);
      setReferrals(data);

      // Fetch transaction totals for each referred user
      const totalsMap: Record<string, { total: number; count: number }> = {};
      await Promise.all(
        data.map(async (r) => {
          try {
            const stats = await getTransactionStatsByUser(r.referredUid);
            totalsMap[r.referredUid] = stats;
          } catch (err) {
            console.error('Failed to load txn stats for', r.referredUid, err);
            totalsMap[r.referredUid] = { total: 0, count: 0 };
          }
        })
      );

      setReferralTxStats(totalsMap);
    } catch (err) {
      console.error('Failed to load referrals:', err);
      showToast('error', 'Failed', 'Could not load referrals');
    } finally {
      setLoadingReferrals(false);
    }
  };

  const handleViewReferredUser = async (referredUid: string) => {
    try {
      setShowReferredUserProfile(true);
      const u = await getUser(referredUid);
      setSelectedReferredUser(u as User | null);
    } catch (err) {
      console.error('Failed to load user:', err);
      showToast('error', 'Failed', 'Could not load user profile');
    }
  };

  const filteredAgents = agents.filter((u) => {
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();

    // Search filter
    const matchesSearch = (
      fullName.includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.phone?.includes(searchTerm)
    );
    if (!matchesSearch) return false;

    // Date filter - use agentAssignedAt if present, fallback to createdAt
    const assignedVal = (u.agentAssignedAt ?? u.createdAt) as Date | string | undefined;
    const assigned = assignedVal ? new Date(assignedVal) : null;
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (!assigned || assigned < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      if (!assigned || assigned > to) return false;
    }

    return true;
  });

  const getAssignedDate = (u: User) => {
    const val = (u.agentAssignedAt ?? u.createdAt) as Date | string | undefined;
    return val ? new Date(val) : new Date(0);
  };

  const sortedAgents = [...filteredAgents].sort((a, b) => {
    const aStats = agentStats[a.id] || { referralCount: 0, transactingCustomers: 0, referralVolume: 0 };
    const bStats = agentStats[b.id] || { referralCount: 0, transactingCustomers: 0, referralVolume: 0 };

    if (sortBy === 'mostReferrals') return bStats.referralCount - aStats.referralCount;
    if (sortBy === 'mostTransactingCustomers') return bStats.transactingCustomers - aStats.transactingCustomers;
    if (sortBy === 'highestReferralVolume') return bStats.referralVolume - aStats.referralVolume;
    if (sortBy === 'newest') return getAssignedDate(b).getTime() - getAssignedDate(a).getTime();
    return getAssignedDate(a).getTime() - getAssignedDate(b).getTime();
  });

  const handleRemoveAgent = async (userId: string) => {
    if (!confirm('Remove agent role from this user?')) return;
    try {
      setActionLoading(true);
      await setUserRole(userId, null);
      try {
        await sendUserNotification(userId, 'Agent role removed', 'Your Agent role has been removed.');
      } catch (noteErr) {
        console.error('Notification failed:', noteErr);
      }
      showToast('success', 'Removed', 'Agent role removed');
      await loadUsers();
    } catch (err) {
      console.error('Failed to remove agent role:', err);
      showToast('error', 'Failed', 'Could not remove agent role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAgent = async (userId: string) => {
    try {
      setActionLoading(true);
      await setUserRole(userId, 'agent');
      try {
        await sendUserNotification(userId, 'Congratulations', 'You are now an agent on PadiPay.');
      } catch (noteErr) {
        console.error('Notification failed:', noteErr);
      }
      showToast('success', 'Added', 'User assigned as agent');
      await loadUsers();
    } catch (err) {
      console.error('Failed to assign agent role:', err);
      showToast('error', 'Failed', 'Could not assign agent role');
    } finally {
      setActionLoading(false);
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agents</h1>
          <p className="text-gray-500 mt-1">Manage agent users</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, email or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'mostReferrals' | 'mostTransactingCustomers' | 'highestReferralVolume' | 'newest' | 'oldest')}
              className="py-2 px-3 border border-gray-300 rounded-lg"
            >
              <option value="mostReferrals">Most referrals</option>
              <option value="mostTransactingCustomers">Most transacting customers</option>
              <option value="highestReferralVolume">Highest referral volume</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>

            <input
              type="date"
              value={dateFrom || ''}
              onChange={(e) => setDateFrom(e.target.value || null)}
              className="py-2 px-3 border border-gray-300 rounded-lg"
            />
            <input
              type="date"
              value={dateTo || ''}
              onChange={(e) => setDateTo(e.target.value || null)}
              className="py-2 px-3 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="flex items-center gap-2">
            <ExportMenu
              data={sortedAgents.map((u) => ({
                id: u.id,
                name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
                email: u.email,
                phone: u.phone,
                referralCount: u.referralCount || 0,
                transactingCustomers: agentStats[u.id]?.transactingCustomers || 0,
                referralVolume: agentStats[u.id]?.referralVolume || 0,
                agentAssignedAt: getAssignedDate(u).toISOString(),
              }))}
              filenameBase="agents"
              title="Agents Export"
              renderPrint={(data) => {
                const rows = (data as Record<string, unknown>[]).map((r) => `<tr><td>${String(r.id ?? '')}</td><td>${String(r.name ?? '')}</td><td>${String(r.email ?? '')}</td><td>${String(r.phone ?? '')}</td><td>${String(r.referralCount ?? 0)}</td><td>${String(r.transactingCustomers ?? 0)}</td><td>₦${Number((r.referralVolume as number) || 0).toLocaleString()}</td></tr>`).join('');
                return `<h1>Agents</h1><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Referral Count</th><th>Transacting Customers</th><th>Referral Volume</th></tr></thead><tbody>${rows}</tbody></table>`;
              }}
            />

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Agent
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]"><Loading /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.length === 0 ? (
            <div className="col-span-full bg-white rounded-lg border border-gray-200 p-6 text-center">
              No agents found. Use Add Agent to assign users as agents.
            </div>
          ) : (
            sortedAgents.map((user) => (
              <div key={user.id} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-semibold text-lg">{user.firstName?.charAt(0) || 'U'}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.firstName} {user.lastName}</h3>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{user.status}</span>
                </div>

                <div className="text-sm text-gray-600">
                  <div>Email: {user.email}</div>
                  {user.phone && <div>Phone: {user.phone}</div>}
                  <div className="flex items-center gap-4">
                    <div>Referrals: <span className="font-medium">{user.referralCount || 0}</span></div>
                    <div>Transacting customers: <span className="font-medium">{agentStats[user.id]?.transactingCustomers ?? 0}</span></div>
                    <div>Referral volume: <span className="font-medium">{agentStats[user.id]?.referralVolume ? ('₦' + Number(agentStats[user.id].referralVolume).toLocaleString()) : '₦0'}</span></div>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/users?userId=${user.id}`)}
                      className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                      title="View profile"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span>View</span>
                    </button>

                    <button
                      onClick={() => loadReferrals(user)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                      title="View referrals"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Referrals</span>
                    </button>
                  </div>

                  <div>
                    <button
                      onClick={() => handleRemoveAgent(user.id)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm hover:bg-red-100"
                      title="Remove agent"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Agent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />

          <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full">
            <div className="flex flex-col gap-3 p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Add Agent</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users by name, email or phone..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    id="select-all-users"
                    type="checkbox"
                    checked={selectAllInModal}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setSelectAllInModal(next);
                      if (next) {
                        const modalUsers = users.filter((u) => {
                          const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
                          return (
                            fullName.includes(modalSearch.toLowerCase()) ||
                            u.email?.toLowerCase().includes(modalSearch.toLowerCase()) ||
                            u.phone?.includes(modalSearch)
                          );
                        });
                        setSelectedUserIds(modalUsers.map((u) => u.id));
                      } else {
                        setSelectedUserIds([]);
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <label htmlFor="select-all-users" className="text-sm text-gray-600">Select all</label>
                </div>

                <div>
                  <button
                    onClick={async () => {
                      if (selectedUserIds.length === 0) return;
                      setActionLoading(true);
                      try {
                        const results = await Promise.allSettled(
                          selectedUserIds.map(async (uid) => {
                            await setUserRole(uid, 'agent');
                            try {
                                await sendUserNotification(uid, 'Congratulations', 'You are now an agent on PadiPay.');
                            } catch (noteErr) {
                              console.error('Notification failed for', uid, noteErr);
                            }
                            return uid;
                          })
                        );

                        const added = results.filter(r => r.status === 'fulfilled').length;
                        showToast('success', 'Added', `Assigned Agent role to ${added} users`);
                        await loadUsers();
                        setShowAddModal(false);
                        setSelectedUserIds([]);
                        setSelectAllInModal(false);
                      } catch (err) {
                        console.error('Bulk add failed:', err);
                        showToast('error', 'Failed', 'Bulk assign failed');
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading || selectedUserIds.length === 0}
                    className="py-1 px-3 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-60"
                  >
                    Add selected
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {(() => {
                const modalUsersFiltered = users.filter((u) => {
                  const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
                  return (
                    fullName.includes(modalSearch.toLowerCase()) ||
                    u.email?.toLowerCase().includes(modalSearch.toLowerCase()) ||
                    u.phone?.includes(modalSearch)
                  );
                });

                if (modalUsersFiltered.length === 0) {
                  return <div className="text-sm text-gray-500">No users found.</div>;
                }

                return modalUsersFiltered.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-4 p-3 border border-gray-100 rounded-lg">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(u.id)}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setSelectedUserIds((prev) => {
                            if (next) return [...prev, u.id];
                            return prev.filter((id) => id !== u.id);
                          });
                          if (!e.target.checked) setSelectAllInModal(false);
                        }}
                        className="w-4 h-4 mt-1"
                      />

                      <div>
                        <div className="font-medium">{u.firstName} {u.lastName}</div>
                        <div className="text-sm text-gray-500">{u.email} {u.phone && ` • ${u.phone}`}</div>
                        <div className="text-sm text-gray-500">Referrals: <span className="font-medium">{u.referralCount || 0}</span></div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setShowAddModal(false);
                          router.push(`/users?userId=${u.id}`);
                        }}
                        className="inline-flex items-center gap-2 px-2 py-1 border border-gray-200 rounded-md text-sm hover:bg-gray-50"
                        title="View profile"
                      >
                        <UserIcon className="w-4 h-4" />
                        <span>View</span>
                      </button>

                      {u.role === 'agent' ? (
                        <button
                          onClick={() => handleRemoveAgent(u.id)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-2 px-2 py-1 border border-red-200 text-red-700 rounded-md text-sm hover:bg-red-50"
                          title="Remove agent"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Remove</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddAgent(u.id)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-2 px-2 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                          title="Add as agent"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowAddModal(false)} className="py-2 px-4 border border-gray-300 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Referrals Modal */}
      {showReferralsFor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowReferralsFor(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Referrals for {showReferralsFor.firstName} {showReferralsFor.lastName}</h2>
              <button onClick={() => setShowReferralsFor(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {loadingReferrals ? (
                <div className="flex items-center justify-center p-6"><Loading /></div>
              ) : referrals.length === 0 ? (
                <div className="text-sm text-gray-500">No referrals found for this agent.</div>
              ) : (
                referrals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                    <div>
                      <div className="font-medium">{r.referredName || r.referredUid}</div>
                      <div className="text-sm text-gray-500">{r.referredUid} • {r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</div>
                      <div className="text-sm text-gray-500">Transactions: <span className="font-medium">{referralTxStats[r.referredUid]?.count || 0} tx • {referralTxStats[r.referredUid] ? ('₦' + Number(referralTxStats[r.referredUid].total || 0).toLocaleString()) : '₦0'}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewReferredUser(r.referredUid)}
                        className="py-1 px-3 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      >
                        View profile
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowReferralsFor(null)} className="py-2 px-4 border border-gray-300 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Referred user profile modal */}
      {showReferredUserProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowReferredUserProfile(false)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">User profile</h2>
              <button onClick={() => setShowReferredUserProfile(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-3">
              {selectedReferredUser ? (
                <div>
                  <div className="font-semibold text-lg">{selectedReferredUser.firstName} {selectedReferredUser.lastName}</div>
                  <div className="text-sm text-gray-500">{selectedReferredUser.email}</div>
                  {selectedReferredUser.phone && <div>Phone: {selectedReferredUser.phone}</div>}
                  <div>Status: {selectedReferredUser.status}</div>
                  <div>Referral code: {selectedReferredUser.referralCode || '—'}</div>
                  <div>Referral count: {selectedReferredUser.referralCount || 0}</div>
                </div>
              ) : (
                <div className="p-6 flex items-center justify-center"><Loading /></div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowReferredUserProfile(false)} className="py-2 px-4 border border-gray-300 rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
