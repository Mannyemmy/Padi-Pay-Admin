'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, X, TicketCheck, Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import { sendUserNotification } from '@/lib/firestore';
import { Pagination } from '@/components/Pagination';
import { EmptyState } from '@/components/EmptyState';
import { showToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TicketCategory = 'failed_transaction' | 'account_issue' | 'kyc' | 'fraud' | 'billing' | 'other';

interface SupportTicket {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  userTag: string;
  accountNumber: string;
  subject: string;
  description: string;
  category: TicketCategory;
  status: TicketStatus;
  createdAt: Date;
  resolvedAt?: Date;
  adminNotes?: string;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  failed_transaction: 'Failed Transaction',
  account_issue: 'Account Issue',
  kyc: 'KYC / Verification',
  fraud: 'Fraud',
  billing: 'Billing',
  other: 'Other',
};

function StatusIcon({ status }: { status: TicketStatus }) {
  switch (status) {
    case 'open': return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'in_progress': return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'resolved': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'closed': return <X className="w-4 h-4 text-gray-400" />;
  }
}

export default function SupportTicketsPage() {
  const { admin } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'support_tickets'),
        orderBy('createdAt', 'desc'),
        limit(500),
      );
      const snap = await getDocs(q);
      const items: SupportTicket[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          ticketId: data.ticketId ?? d.id,
          userId: data.userId ?? '',
          userName: data.userName ?? 'Unknown',
          userTag: data.userTag ?? '',
          accountNumber: data.accountNumber ?? '',
          subject: data.subject ?? '',
          description: data.description ?? '',
          category: (data.category ?? 'other') as TicketCategory,
          status: (data.status ?? 'open') as TicketStatus,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt ?? 0),
          resolvedAt: data.resolvedAt?.toDate ? data.resolvedAt.toDate() : undefined,
          adminNotes: data.adminNotes ?? '',
        };
      });
      setTickets(items);
    } catch (e) {
      console.error('Failed to fetch support tickets:', e);
      showToast('error', 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        !searchTerm ||
        t.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.userTag.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.accountNumber.includes(searchTerm);
      const matchStatus = filterStatus === 'all' || t.status === filterStatus;
      const matchCategory = filterCategory === 'all' || t.category === filterCategory;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [tickets, searchTerm, filterStatus, filterCategory]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / pageSize)),
    [filtered.length],
  );

  const handleUpdateTicket = async (
    ticketId: string,
    status: TicketStatus,
    notes: string,
    prevStatus?: TicketStatus,
    prevNotes?: string,
  ) => {
    setUpdating(true);
    try {
      const ticket = tickets.find((t) => t.id === ticketId);

      const ref = doc(db, 'support_tickets', ticketId);
      const updates: Record<string, any> = {
        status,
        adminNotes: notes,
      };
      if (status === 'resolved' || status === 'closed') {
        updates.resolvedAt = serverTimestamp();
        updates.resolvedBy = admin?.email ?? 'admin';
      }
      await updateDoc(ref, updates);

      // --- Notify the user ---
      if (ticket) {
        const statusChanged = prevStatus !== undefined && status !== prevStatus;
        const notesChanged =
          prevNotes !== undefined &&
          notes.trim() !== prevNotes.trim() &&
          notes.trim().length > 0;

        if (statusChanged || notesChanged) {
          let notifTitle: string;
          let notifBody: string;

          if (statusChanged && notesChanged) {
            notifTitle = `Support ticket ${STATUS_LABELS[status].toLowerCase()}`;
            notifBody = `Your ticket "${ticket.subject}" is now ${STATUS_LABELS[status].toLowerCase()}. Support: ${notes.trim()}`;
          } else if (statusChanged) {
            notifTitle = `Support ticket ${STATUS_LABELS[status].toLowerCase()}`;
            notifBody = `Your ticket "${ticket.subject}" has been updated to: ${STATUS_LABELS[status]}.`;
          } else {
            notifTitle = 'Support response';
            notifBody = `Support replied to "${ticket.subject}": ${notes.trim()}`;
          }

          // Write to in-app notifications collection
          await addDoc(
            collection(db, 'users', ticket.userId, 'notifications'),
            {
              type: 'support',
              title: notifTitle,
              body: notifBody,
              ticketId: ticket.ticketId,
              read: false,
              timestamp: serverTimestamp(),
            },
          );

          // Send push notification via Cloud Function (non-critical)
          try {
            await sendUserNotification(ticket.userId, notifTitle, notifBody);
          } catch (pushError) {
            console.error('Failed to send push notification:', pushError);
            // Push failure is non-critical
          }
        }
      }

      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticketId
            ? { ...t, status, adminNotes: notes }
            : t,
        ),
      );
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => prev ? { ...prev, status, adminNotes: notes } : prev);
      }
      showToast('success', 'Ticket updated');
    } catch (e) {
      console.error('Failed to update ticket:', e);
      showToast('error', 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    open: tickets.filter((t) => t.status === 'open').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  }), [tickets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TicketCheck className="w-6 h-6 text-blue-600" />
            Support Tickets
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Customer issues submitted via MyPadi AI
          </p>
        </div>
        <button
          onClick={fetchTickets}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Open', value: stats.open, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'In Progress', value: stats.in_progress, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
          { label: 'Resolved', value: stats.resolved, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Search by name, tag, subject, ticket ID..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
        >
          <option value="all">All Statuses</option>
          {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
        >
          <option value="all">All Categories</option>
          {(Object.keys(CATEGORY_LABELS) as TicketCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<TicketCheck className="w-8 h-8" />}
          title="No support tickets found"
          description="Try adjusting your search or filter criteria."
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {['Ticket ID', 'User', 'Subject', 'Category', 'Status', 'Created', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {paginated.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                      #{ticket.ticketId.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{ticket.userName}</div>
                      {ticket.userTag && (
                        <div className="text-xs text-gray-400">@{ticket.userTag}</div>
                      )}
                      {ticket.accountNumber && (
                        <div className="text-xs text-gray-400">{ticket.accountNumber}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-gray-900 dark:text-white truncate">{ticket.subject}</div>
                      <div className="text-xs text-gray-400 truncate">{ticket.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                        {CATEGORY_LABELS[ticket.category]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[ticket.status]}`}>
                        <StatusIcon status={ticket.status} />
                        {STATUS_LABELS[ticket.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {ticket.createdAt.toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                      <div>{ticket.createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelectedTicket(ticket); setAdminNotes(ticket.adminNotes ?? ''); }}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                      >
                        View / Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-100 dark:border-gray-700">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ticket Details</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">#{selectedTicket.ticketId.slice(-8).toUpperCase()}</p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* User info */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-1">
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">User</p>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedTicket.userName}</p>
                {selectedTicket.userTag && <p className="text-sm text-gray-500">@{selectedTicket.userTag}</p>}
                {selectedTicket.accountNumber && <p className="text-sm text-gray-500">{selectedTicket.accountNumber}</p>}
              </div>

              {/* Subject & description */}
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Subject</p>
                <p className="font-medium text-gray-900 dark:text-white">{selectedTicket.subject}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Description</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Category</p>
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full">
                    {CATEGORY_LABELS[selectedTicket.category]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1">Created</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedTicket.createdAt.toLocaleString('en-GB')}
                  </p>
                </div>
              </div>

              {/* Status update */}
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1 block">
                  Update Status
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleUpdateTicket(
                        selectedTicket.id,
                        s,
                        adminNotes,
                        selectedTicket.status,
                        selectedTicket.adminNotes ?? '',
                      )}
                      disabled={updating || selectedTicket.status === s}
                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${
                        selectedTicket.status === s
                          ? STATUS_COLORS[s] + ' border-transparent'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-500'
                      } disabled:opacity-50`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin notes */}
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-1 block">
                  Admin Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Add internal notes about this ticket..."
                  className="w-full text-sm px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                  onClick={() => handleUpdateTicket(
                    selectedTicket.id,
                    selectedTicket.status,
                    adminNotes,
                    selectedTicket.status,
                    selectedTicket.adminNotes ?? '',
                  )}
                  disabled={updating}
                  className="mt-2 w-full py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {updating ? 'Saving...' : 'Save Notes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
