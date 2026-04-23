'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Plus,
  Eye,
  EyeOff,
  Search,
  CheckCircle,
  XCircle,
  Wallet,
  Users,
  TrendingUp,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { showToast } from '@/components/Toast';
import {
  getSuperAgents,
  createSuperAgentFn,
  sendSuperAgentWelcomeEmailFn,
  updateSuperAgentStatusFn,
  lookupUserByEmail,
  SuperAgent,
  CreateSuperAgentPayload,
} from '@/lib/firestore';

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SuperAgentsPage() {
  const { loading: authLoading } = useAuth();
  const [agents, setAgents] = useState<SuperAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    bvn: '',
    dateOfBirth: '',
    gender: '',
    addressState: '',
    addressCity: '',
    addressLine1: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

    // Email-lookup state (step 1 result)
    const [lookup, setLookup] = useState<{
      status: 'idle' | 'loading' | 'found' | 'not-found';
      firstName: string;
      lastName: string;
      phone: string;
      hasAnchorCustomer: boolean;
      bvn: string;
      dateOfBirth: string;
      gender: string;
    }>({
      status: 'idle',
      firstName: '',
      lastName: '',
      phone: '',
      hasAnchorCustomer: false,
      bvn: '',
      dateOfBirth: '',
      gender: '',
    });

  // Status toggle modal
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    agent: SuperAgent | null;
    newStatus: 'active' | 'suspended';
  }>({ open: false, agent: null, newStatus: 'active' });
  const [updatingStatus, setUpdatingStatus] = useState(false);

  async function loadAgents() {
    setLoading(true);
    try {
      const data = await getSuperAgents();
      setAgents(data);
    } catch (err) {
      console.error('Failed to load Super Agents:', err);
      showToast('error', 'Failed to load Super Agents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  const filtered = agents.filter(
    (a) =>
      a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.referral_code.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === 'active').length;
  const totalEarnings = agents.reduce((sum, a) => sum + a.total_earnings, 0);
  const totalPending = agents.reduce((sum, a) => sum + a.pending_earnings, 0);

  function validateStep(s: number): string {
    if (s === 1) {
      if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'A valid email is required.';
      if (lookup.status !== 'found' && lookup.status !== 'not-found') return 'Please look up the email address first.';
    }
    if (s === 2) {
      if (!form.firstName || !form.lastName) return 'First and last name are required.';
      if (!form.phone) return 'Phone number is required.';
      if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters.';
      if (!lookup.hasAnchorCustomer) {
        if (!form.bvn || !/^\d{11}$/.test(form.bvn)) return 'BVN must be exactly 11 digits.';
        if (!form.dateOfBirth) return 'Date of birth is required.';
        if (!form.gender) return 'Gender is required.';
      }
    }
    if (s === 3) {
      if (!form.addressLine1) return 'Address line 1 is required.';
      if (!form.addressCity) return 'City is required.';
      if (!form.addressState) return 'State is required.';
    }
    return '';
  }

  async function handleLookup() {
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setFormError('Please enter a valid email address first.');
      return;
    }
    setFormError('');
    setLookup({
      status: 'loading',
      firstName: '',
      lastName: '',
      phone: '',
      hasAnchorCustomer: false,
      bvn: '',
      dateOfBirth: '',
      gender: '',
    });
    try {
      const result = await lookupUserByEmail(form.email);
      if (result.found) {
        setLookup({
          status: 'found',
          firstName: result.firstName,
          lastName: result.lastName,
          phone: result.phone,
          hasAnchorCustomer: result.hasAnchorCustomer,
          bvn: result.bvn,
          dateOfBirth: result.dateOfBirth,
          gender: result.gender,
        });
        setForm((f) => ({
          ...f,
          firstName: result.firstName || f.firstName,
          lastName: result.lastName || f.lastName,
          phone: result.phone || f.phone,
          bvn: result.hasAnchorCustomer ? (result.bvn || f.bvn) : f.bvn,
          dateOfBirth: result.hasAnchorCustomer ? (result.dateOfBirth || f.dateOfBirth) : f.dateOfBirth,
          gender: result.hasAnchorCustomer ? (result.gender || f.gender) : f.gender,
        }));
      } else {
        setLookup({
          status: 'not-found',
          firstName: '',
          lastName: '',
          phone: '',
          hasAnchorCustomer: false,
          bvn: '',
          dateOfBirth: '',
          gender: '',
        });
      }
    } catch {
      setFormError('Lookup failed. Please try again.');
      setLookup({
        status: 'idle',
        firstName: '',
        lastName: '',
        phone: '',
        hasAnchorCustomer: false,
        bvn: '',
        dateOfBirth: '',
        gender: '',
      });
    }
  }

  function handleNext() {
    const err = validateStep(step);
    if (err) { setFormError(err); return; }
    setFormError('');
    setStep((s) => s + 1);
  }

  function resetModal() {
    setShowCreateModal(false);
    setStep(1);
    setFormError('');
    setLookup({
      status: 'idle',
      firstName: '',
      lastName: '',
      phone: '',
      hasAnchorCustomer: false,
      bvn: '',
      dateOfBirth: '',
      gender: '',
    });
    setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', bvn: '', dateOfBirth: '', gender: '', addressState: '', addressCity: '', addressLine1: '' });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    // Validate step 2 fields (always required)
    const step2Err = validateStep(2);
    if (step2Err) { setFormError(step2Err); return; }
    // Validate step 3 only if address is needed
    if (!lookup.hasAnchorCustomer) {
      const step3Err = validateStep(3);
      if (step3Err) { setFormError(step3Err); return; }
    }
    const { firstName, lastName, email, phone, password, bvn, dateOfBirth, gender, addressState, addressCity, addressLine1 } = form;

    setCreating(true);
    try {
      const payload: CreateSuperAgentPayload = { firstName, lastName, email, phone, password, bvn, dateOfBirth, gender, addressState, addressCity, addressLine1 };
      const { referralCode } = await createSuperAgentFn(payload);

      // Send welcome email (non-blocking)
      sendSuperAgentWelcomeEmailFn({
        email,
        firstName,
        lastName,
        password,
        referralCode,
        loginUrl: 'https://padipay.co/super-agent/login',
      }).catch((err) => console.warn('Welcome email failed:', err));

      showToast('success', `Super Agent created! Code: ${referralCode}`);
      resetModal();
      await loadAgents();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to create Super Agent.';
      setFormError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusToggle() {
    if (!statusModal.agent) return;
    setUpdatingStatus(true);
    try {
      await updateSuperAgentStatusFn(statusModal.agent.id, statusModal.newStatus);
      showToast('success', `Agent ${statusModal.newStatus === 'active' ? 'activated' : 'suspended'}`);
      setStatusModal({ open: false, agent: null, newStatus: 'active' });
      await loadAgents();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to update status.';
      showToast('error', msg);
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (authLoading) return <Loading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Agents"
        description="Manage super agents who refer business owners and earn commissions on NIP transfers."
        action={{
          label: 'Create Super Agent',
          onClick: () => setShowCreateModal(true),
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total Agents" value={totalAgents} icon={<Users className="h-5 w-5" />} />
        <StatsCard title="Active Agents" value={activeAgents} icon={<CheckCircle className="h-5 w-5 text-green-500" />} />
        <StatsCard title="Total Earned" value={formatNaira(totalEarnings)} icon={<TrendingUp className="h-5 w-5 text-blue-500" />} />
        <StatsCard title="Pending Earnings" value={formatNaira(totalPending)} icon={<Wallet className="h-5 w-5 text-amber-500" />} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <AlertCircle className="h-10 w-10 mb-3" />
            <p className="text-sm">No Super Agents found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  {['Name', 'Email', 'Phone', 'Referral Code', 'Referrals', 'Total Earned', 'Pending', 'Status', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent) => (
                  <tr
                    key={agent.id}
                    className="border-b border-gray-100 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {agent.full_name}
                    </td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">{agent.email}</td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      {agent.phone}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg">
                        {agent.referral_code}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-600 dark:text-gray-300">
                      {agent.total_referrals}
                    </td>
                    <td className="px-4 py-4 font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                      {formatNaira(agent.total_earnings)}
                    </td>
                    <td className="px-4 py-4 font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      {formatNaira(agent.pending_earnings)}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          agent.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {agent.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() =>
                          setStatusModal({
                            open: true,
                            agent,
                            newStatus: agent.status === 'active' ? 'suspended' : 'active',
                          })
                        }
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                          agent.status === 'active'
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                      >
                        {agent.status === 'active' ? (
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" /> Suspend
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> Activate
                          </span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal — multi-step wizard */}
      {/* Create Modal — email-first multi-step wizard */}
      {showCreateModal && (() => {
        const stepLabels = lookup.hasAnchorCustomer
          ? ['Email', 'Details']
          : ['Email', 'Details', 'Address'];
        const stepDescriptions = [
          'Step 1 — Look up user by email',
          lookup.hasAnchorCustomer ? `Step 2 of 2 — Agent details` : 'Step 2 of 3 — Agent details & identity',
          'Step 3 of 3 — Address',
        ];
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="mb-5">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create Super Agent</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{stepDescriptions[step - 1]}</p>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2 mb-6">
                {stepLabels.map((label, i) => {
                  const s = i + 1;
                  return (
                    <Fragment key={s}>
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                            s < step
                              ? 'bg-blue-600 text-white'
                              : s === step
                              ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {s < step ? <CheckCircle className="h-4 w-4" /> : s}
                        </div>
                        <span
                          className={`text-xs font-medium hidden sm:block ${
                            s <= step ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      {i < stepLabels.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 rounded transition-colors ${
                            s < step ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                        />
                      )}
                    </Fragment>
                  );
                })}
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreate}>
                {/* Step 1 — Email Lookup */}
                {step === 1 && (
                  <div className="space-y-4">
                    <FormField
                      label="Email address"
                      value={form.email}
                      onChange={(v) => {
                        setForm({ ...form, email: v });
                        setLookup({
                          status: 'idle',
                          firstName: '',
                          lastName: '',
                          phone: '',
                          hasAnchorCustomer: false,
                          bvn: '',
                          dateOfBirth: '',
                          gender: '',
                        });
                        setFormError('');
                      }}
                      placeholder="agent@example.com"
                      type="email"
                    />
                    <button
                      type="button"
                      onClick={handleLookup}
                      disabled={!form.email || lookup.status === 'loading'}
                      className="w-full flex items-center justify-center gap-2 border border-blue-600 text-blue-600 font-semibold py-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {lookup.status === 'loading' ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Looking up…</>
                      ) : (
                        'Look up user'
                      )}
                    </button>

                    {lookup.status === 'found' && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                              User found: {lookup.firstName} {lookup.lastName}
                            </p>
                            {lookup.hasAnchorCustomer ? (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                                KYC on file — identity verification will be reused.
                              </p>
                            ) : (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                                No KYC on file — identity details will be required.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {lookup.status === 'not-found' && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            No existing user — you&apos;ll fill in all details.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2 — Agent Details + conditional KYC */}
                {step === 2 && (
                  <div className="space-y-4">
                    {lookup.status === 'found' && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-3 py-2">
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                          Pre-filled from existing user — edit as needed.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        label="First name"
                        value={form.firstName}
                        onChange={(v) => setForm({ ...form, firstName: v })}
                        placeholder="John"
                        readOnly={lookup.hasAnchorCustomer}
                      />
                      <FormField
                        label="Last name"
                        value={form.lastName}
                        onChange={(v) => setForm({ ...form, lastName: v })}
                        placeholder="Doe"
                        readOnly={lookup.hasAnchorCustomer}
                      />
                    </div>
                    <FormField
                      label="Phone"
                      value={form.phone}
                      onChange={(v) => setForm({ ...form, phone: v })}
                      placeholder="08012345678"
                      type="tel"
                      readOnly={lookup.hasAnchorCustomer}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          placeholder="Minimum 8 characters"
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {lookup.hasAnchorCustomer ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl px-3 py-2.5">
                          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          <p className="text-xs text-green-700 dark:text-green-300 font-medium">
                            KYC already verified — BVN and identity details are reused and locked.
                          </p>
                        </div>

                        <FormField
                          label="BVN"
                          value={form.bvn}
                          onChange={(v) => setForm({ ...form, bvn: v })}
                          placeholder="Not available"
                          readOnly
                        />

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                              Date of Birth
                            </label>
                            <input
                              type="date"
                              value={form.dateOfBirth}
                              readOnly
                              disabled
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-300 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                              Gender
                            </label>
                            <input
                              type="text"
                              value={form.gender || 'Not available'}
                              readOnly
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-300 focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                            Identity Verification
                          </p>
                        </div>
                        <FormField
                          label="BVN (11 digits)"
                          value={form.bvn}
                          onChange={(v) => setForm({ ...form, bvn: v })}
                          placeholder="12345678901"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                              Date of Birth
                            </label>
                            <input
                              type="date"
                              value={form.dateOfBirth}
                              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                              Gender
                            </label>
                            <select
                              value={form.gender}
                              onChange={(e) => setForm({ ...form, gender: e.target.value })}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select gender</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Others">Others</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Step 3 — Address (only when new Anchor customer needed) */}
                {step === 3 && (
                  <div className="space-y-4">
                    <FormField
                      label="Address Line 1"
                      value={form.addressLine1}
                      onChange={(v) => setForm({ ...form, addressLine1: v })}
                      placeholder="123 Main Street"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        label="City"
                        value={form.addressCity}
                        onChange={(v) => setForm({ ...form, addressCity: v })}
                        placeholder="Lagos"
                      />
                      <FormField
                        label="State"
                        value={form.addressState}
                        onChange={(v) => setForm({ ...form, addressState: v })}
                        placeholder="Lagos"
                      />
                    </div>
                  </div>
                )}

                {/* Navigation buttons */}
                <div className="flex gap-3 pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 1) { resetModal(); }
                      else { setFormError(''); setStep((s) => s - 1); }
                    }}
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    {step === 1 ? 'Cancel' : 'Back'}
                  </button>

                  {step === 1 && (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={lookup.status !== 'found' && lookup.status !== 'not-found'}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Continue
                    </button>
                  )}
                  {step === 2 && !lookup.hasAnchorCustomer && (
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
                    >
                      Next
                    </button>
                  )}
                  {((step === 2 && lookup.hasAnchorCustomer) || step === 3) && (
                    <button
                      type="submit"
                      disabled={creating}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      {creating ? 'Creating…' : 'Create Agent'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Status confirm modal */}
      <ConfirmModal
        isOpen={statusModal.open}
        type={statusModal.newStatus === 'suspended' ? 'danger' : 'confirm'}
        title={`${statusModal.newStatus === 'suspended' ? 'Suspend' : 'Activate'} Super Agent`}
        message={`Are you sure you want to ${statusModal.newStatus === 'suspended' ? 'suspend' : 'activate'} ${statusModal.agent?.full_name}?`}
        confirmLabel={statusModal.newStatus === 'suspended' ? 'Suspend' : 'Activate'}
        isLoading={updatingStatus}
        onConfirm={handleStatusToggle}
        onCancel={() => setStatusModal({ open: false, agent: null, newStatus: 'active' })}
      />
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          readOnly
            ? 'bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-300 cursor-not-allowed'
            : 'bg-white dark:bg-gray-800'
        }`}
      />
    </div>
  );
}
