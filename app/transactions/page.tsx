'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, X, ExternalLink, Loader, FileText, CheckCircle, Building2, CreditCard } from 'lucide-react';
import { Transaction, User, Business } from '@/lib/types';
import { getTransactions, getUsers, getBusinesses, getTransactionsByUser } from '@/lib/firestore';
import { Pagination } from '@/components/Pagination';
import { EmptyState } from '@/components/EmptyState';

type RawTxn = Record<string, unknown>;

const pickString = (obj: RawTxn, ...keys: string[]) => {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim().length) return v;
  }
  return undefined;
};

const pickNumber = (obj: RawTxn, ...keys: string[]) => {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
};

const pickDate = (obj: RawTxn, ...keys: string[]) => {
  for (const key of keys) {
    const v = obj[key] as any;
    if (v?.toDate) return v.toDate();
    if (typeof v === 'string' || typeof v === 'number') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return undefined;
};

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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [sortField, setSortField] = useState<'amount' | 'date'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [txns, usersData, businessesData] = await Promise.all([
          getTransactions(),
          getUsers(),
          getBusinesses(),
        ]);

        const userMap = new Map(usersData.map((u) => [u.id, u]));

        const normalized = txns.map((t) => {
          const raw: RawTxn = t as RawTxn;
          const user = userMap.get(pickString(raw, 'userId', 'user_id') || '');

          const parsedDate = pickDate(raw, 'timestamp', 'date', 'createdAt');
          const amount = pickNumber(raw, 'amount') ?? 0;
          const type = pickString(raw, 'type') || 'unknown';
          const nestedApiStatus = (raw as any)?.api_response?.data?.attributes?.status;
          const nestedFullDataStatus = (raw as any)?.fullData?.status;
          const nestedDetailStatus = (raw as any)?.detail?.status;
          const statusSource =
            pickString(raw, 'status') ||
            (typeof nestedApiStatus === 'string' ? nestedApiStatus : undefined) ||
            (typeof nestedFullDataStatus === 'string' ? nestedFullDataStatus : undefined) ||
            (typeof nestedDetailStatus === 'string' ? nestedDetailStatus : undefined) ||
            'unknown';
          const status = statusSource.toLowerCase();
          const reference = pickString(raw, 'reference', 'transaction_reference', 'id') || t.id;

          return {
            ...t,
            id: t.id || reference,
            userName: user
              ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || user.phone
              : pickString(raw, 'userName'),
            date: parsedDate,
            amount,
            type,
            status: status as Transaction['status'],
            reference,
          } as Transaction;
        });

        setTransactions(normalized);
        setUsers(usersData);
        setBusinesses(businessesData);
        setError(null);
      } catch (err) {
        console.error('Failed to load transactions', err);
        setError('Failed to load transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch transactions for selected user
  useEffect(() => {
    const fetchUserTransactions = async () => {
      if (!selectedUser?.id) {
        setUserTransactions([]);
        return;
      }

      try {
        setLoadingTransactions(true);
        const txns = await getTransactionsByUser(selectedUser.id);
        const sorted = txns
          .sort((a, b) => {
            const dateA = a.date instanceof Date ? a.date : new Date(a.date || 0);
            const dateB = b.date instanceof Date ? b.date : new Date(b.date || 0);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, 3);
        setUserTransactions(sorted);
      } catch (err) {
        console.error('Failed to load user transactions:', err);
        setUserTransactions([]);
      } finally {
        setLoadingTransactions(false);
      }
    };

    fetchUserTransactions();
  }, [selectedUser?.id]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterType]);

  const filteredTransactions = useMemo(() => {
    const filtered = transactions.filter((transaction) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        (transaction.userName || '').toLowerCase().includes(search) ||
        (transaction.reference || '').toLowerCase().includes(search) ||
        (transaction.id || '').toLowerCase().includes(search);

      const matchesStatus = filterStatus === 'all' || transaction.status === filterStatus;
      const matchesType = filterType === 'all' || transaction.type === filterType;

      return matchesSearch && matchesStatus && matchesType;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      if (sortField === 'amount') {
        aVal = a.amount || 0;
        bVal = b.amount || 0;
      } else {
        aVal = a.date instanceof Date ? a.date.getTime() : new Date(a.date || 0).getTime();
        bVal = b.date instanceof Date ? b.date.getTime() : new Date(b.date || 0).getTime();
      }

      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return filtered;
  }, [transactions, searchTerm, filterStatus, filterType, sortField, sortDirection]);

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTransactions.slice(start, start + pageSize);
  }, [filteredTransactions, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const getUserBusinesses = (userId: string) => {
    return businesses.filter((b) => (b as any).ownerId === userId || b.id === userId);
  };


  const renderTypeSpecific = (txn: Transaction) => {
    const t = txn as unknown as Record<string, unknown>;

    const rows: Array<[string, string]> = [];

    const pushStr = (label: string, value: unknown) => {
      if (value === undefined || value === null) return;
      const v = typeof value === 'string' ? value : typeof value === 'number' ? value.toString() : undefined;
      if (v) rows.push([label, v]);
    };

    // Common optional fields
    pushStr('Account Number', t.account_number);
    pushStr('Bank', t.bankName);
    if (t.recipientName || t.senderName) {
      const recipient = typeof t.recipientName === 'string' ? t.recipientName : '';
      const sender = typeof t.senderName === 'string' ? t.senderName : '';
      pushStr('Recipient / Sender', `${recipient}${recipient && sender ? ' / ' : ''}${sender}`);
    }
    pushStr('Reason', t.reason);
    pushStr('Purpose', t.purpose);
    pushStr('Reference Txn ID', t.referenceTransactionId);
    pushStr('Card ID', t.card_id);
    pushStr('Cardholder ID', t.cardholder_id);
    pushStr('Card Txn Type', t.card_transaction_type);
    pushStr('Network', t.network);
    pushStr('Phone', t.phoneNumber || t.phone_number);
    pushStr('Product', t.bundle || t.plan || t.product);
    pushStr('User ID', t.userId || t.user_id);
    pushStr('Receiver ID', t.receiverId || t.receiver_id);
    pushStr('Sender ID', t.senderId || t.sender_id);

    // Amounts found in nested payloads
    const apiAmount = (t.api_response as any)?.data?.attributes?.amount;
    if (apiAmount !== undefined) pushStr('API Amount', apiAmount);
    const debitAmount = t.debitAmount || t.debit_amount;
    if (debitAmount !== undefined) pushStr('Debit Amount', debitAmount);
    const commission = t.commissionEarned || t.commissionAmount;
    if (commission !== undefined) pushStr('Commission', commission);

    // Status from nested payloads
    const nestedStatus = (t.api_response as any)?.data?.attributes?.status || (t.fullData as any)?.status || (t.detail as any)?.status;
    if (nestedStatus) pushStr('Upstream Status', nestedStatus);

    // References
    const nestedRef = (t.api_response as any)?.data?.attributes?.reference || (t.detail as any)?.reference;
    if (nestedRef && nestedRef !== (txn.reference || txn.id)) pushStr('Upstream Reference', nestedRef);

    // Counterparty / bank
    pushStr('Bank Code', t.bank_code);
    pushStr('Currency', t.currency);

    // Ghost/nfc/giveaway specific text
    if (txn.type === 'giveaway_claim' && t.reason) pushStr('Giveaway Reason', t.reason);
    if (txn.type === 'giveaway_create' && t.reason) pushStr('Giveaway Reason', t.reason);

    return rows.length ? (
      rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 text-sm">
          <span className="text-gray-500">{label}</span>
          <span className="text-gray-800 text-right break-all">{value}</span>
        </div>
      ))
    ) : (
      <p className="text-sm text-gray-500">No additional details</p>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Transactions</h1>
        <p className="text-sm sm:text-base text-gray-500 mt-1">View and manage all transactions</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by user, reference, or transaction ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex gap-2">
            <span className="text-sm font-medium text-gray-700 flex items-center">Status:</span>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                filterStatus === 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('success')}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                filterStatus === 'success'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Success
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                filterStatus === 'pending'
                  ? 'bg-yellow-600 text-white border-yellow-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilterStatus('failed')}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                filterStatus === 'failed'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Failed
            </button>
          </div>

          <div className="flex gap-2 ml-4">
            <span className="text-sm font-medium text-gray-700 flex items-center">Type:</span>
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                filterType === 'all'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('deposit')}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                filterType === 'deposit'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Deposit
            </button>
            <button
              onClick={() => setFilterType('withdrawal')}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                filterType === 'withdrawal'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Withdrawal
            </button>
            <button
              onClick={() => setFilterType('transfer')}
              className={`px-3 py-1 text-sm rounded-lg border transition-colors ${
                filterType === 'transfer'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Transfer
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="w-12 h-12" />}
            title="No transactions found"
            description={searchTerm || filterStatus !== 'all' ? "Try adjusting your filters or search terms" : "No transactions yet"}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {transaction.userName || 'Unknown user'}
                        </div>
                        <div className="text-xs text-gray-500">{transaction.reference || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {formatTransactionType(transaction.type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatAmount(transaction.amount, (transaction as any).currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full badge badge-${
                          transaction.status === 'success' || transaction.status === 'successful'
                            ? 'success'
                            : transaction.status === 'pending'
                            ? 'pending'
                            : 'danger'
                        }`}>
                          {transaction.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {transaction.date ? new Date(transaction.date).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedTransaction(transaction)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          {/* Pagination Controls */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700 dark:text-gray-300">
                Rows per page:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="ml-2 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Showing {Math.min((currentPage - 1) * pageSize + 1, filteredTransactions.length)}-{Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length}
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

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in"
            onClick={() => setSelectedTransaction(null)}
          />
          <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Transaction Details</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedTransaction.id}</p>
              </div>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-gray-500">Transaction ID</label>
                  <p className="text-gray-900 font-medium">{selectedTransaction.id}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Reference</label>
                  <p className="text-gray-900 font-medium">{selectedTransaction.reference}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">User</label>
                  <p className="text-gray-900 font-medium">{selectedTransaction.userName || 'Unknown user'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Type</label>
                  <p className="text-gray-900 font-medium capitalize">
                    {formatTransactionType(selectedTransaction.type)}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Amount</label>
                  <p className="text-gray-900 font-medium text-lg">
                    {formatAmount(selectedTransaction.amount, (selectedTransaction as any).currency)}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Status</label>
                  <span
                    className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full mt-1 ${
                      selectedTransaction.status === 'success' || selectedTransaction.status === 'successful'
                        ? 'bg-green-100 text-green-800'
                        : selectedTransaction.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedTransaction.status}
                  </span>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Date</label>
                  <p className="text-gray-900 font-medium">
                    {selectedTransaction.date ? new Date(selectedTransaction.date).toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Description</label>
                  <p className="text-gray-900 font-medium">
                    {selectedTransaction.description || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Type-specific details */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-gray-800">Details</h4>
                <div className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-1">
                  {renderTypeSpecific(selectedTransaction)}
                </div>
              </div>

              {selectedTransaction.status === 'pending' && (
                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  <button className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    Approve Transaction
                  </button>
                  <button className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                    Reject Transaction
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
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
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
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

                {/* Banking Information */}
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
                  {loadingTransactions ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : userTransactions.length > 0 ? (
                    <div className="space-y-3">
                      {userTransactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 capitalize">
                              {formatTransactionType(transaction.type)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {transaction.date ? new Date(transaction.date).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                          <p
                            className={`text-sm font-semibold ${
                              transaction.amount && transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {transaction.amount && transaction.amount > 0 ? '+' : ''}₦
                            {Math.abs(transaction.amount || 0).toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">No transactions found</p>
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
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{business.business_data?.name}</p>
                              <p className="text-xs text-gray-500">{business.business_data?.industry}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                business.getAnchorData?.kybVerification?.data?.attributes?.kycStatus === 'APPROVED'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {business.getAnchorData?.kybVerification?.data?.attributes?.kycStatus || 'Pending'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-8">No businesses registered</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
