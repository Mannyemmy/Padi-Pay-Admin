'use client';

import { useState } from 'react';
import { Trash2, Zap, Building2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { triggerCleanup, triggerGeneration, seedCompanyAccount } from '@/lib/mock-actions';
import { showToast } from '@/components/Toast';

type OpState = 'idle' | 'loading' | 'success' | 'error';

interface Result {
  label: string;
  counts: Record<string, number | string>;
}

export default function DataToolsPage() {
  const [cleanupState, setCleanupState] = useState<OpState>('idle');
  const [generateState, setGenerateState] = useState<OpState>('idle');
  const [seedState, setSeedState] = useState<OpState>('idle');
  const [cleanupResult, setCleanupResult] = useState<Result | null>(null);
  const [generateResult, setGenerateResult] = useState<Result | null>(null);
  const [seedResult, setSeedResult] = useState<Result | null>(null);

  const handleCleanup = async () => {
    if (cleanupState === 'loading') return;
    setCleanupState('loading');
    setCleanupResult(null);
    try {
      const res = await triggerCleanup();
      setCleanupResult({ label: 'Deleted', counts: res.deleted ?? {} });
      setCleanupState('success');
      showToast('success', 'Mock data cleaned up successfully');
    } catch (err: any) {
      console.error('Cleanup failed', err);
      setCleanupState('error');
      showToast('error', err?.message ?? 'Cleanup failed');
    }
  };

  const handleGenerate = async () => {
    if (generateState === 'loading') return;
    setGenerateState('loading');
    setGenerateResult(null);
    try {
      const res = await triggerGeneration();
      setGenerateResult({ label: 'Created', counts: res.created ?? {} });
      setGenerateState('success');
      showToast('success', 'Mock data generated successfully');
    } catch (err: any) {
      console.error('Generate failed', err);
      setGenerateState('error');
      showToast('error', err?.message ?? 'Generation failed');
    }
  };

  const handleSeed = async () => {
    if (seedState === 'loading') return;
    setSeedState('loading');
    setSeedResult(null);
    try {
      const res = await seedCompanyAccount();
      setSeedResult({ label: 'Set', counts: {
        accountNumber: res.accountNumber as any,
        availableBalance: `₦${(res.availableBalance / 100).toLocaleString()}` as any,
      }});
      setSeedState('success');
      showToast('success', 'Company account seeded');
    } catch (err: any) {
      console.error('Seed failed', err);
      setSeedState('error');
      showToast('error', err?.message ?? 'Seed failed');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Data Tools
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage mock data in Firestore. These actions are irreversible.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cleanup Card */}
        <ActionCard
          title="Cleanup Mock Data"
          description="Delete all documents with mock: true, mock_ user IDs, and legacy mock entries across users, transactions, login logs, referrals, businesses, and activity logs."
          buttonLabel="Run Cleanup"
          buttonVariant="danger"
          icon={<Trash2 className="w-5 h-5" />}
          state={cleanupState}
          result={cleanupResult}
          onAction={handleCleanup}
        />

        {/* Generate Card */}
        <ActionCard
          title="Generate Mock Data"
          description="Generate a fresh batch of realistic Nigerian mock data: users, businesses, transactions, login logs, referrals, and activity logs."
          buttonLabel="Generate Data"
          buttonVariant="primary"
          icon={<Zap className="w-5 h-5" />}
          state={generateState}
          result={generateResult}
          onAction={handleGenerate}
        />

        {/* Seed Company Account Card */}
        <ActionCard
          title="Seed Company Account"
          description="Write a 9 Payment Service Bank account number and random balance into the company/account_details Firestore doc. Shows on the Dashboard Company Wallet card."
          buttonLabel="Seed Account"
          buttonVariant="primary"
          icon={<Building2 className="w-5 h-5" />}
          state={seedState}
          result={seedResult}
          onAction={handleSeed}
        />
      </div>
    </div>
  );
}

interface ActionCardProps {
  title: string;
  description: string;
  buttonLabel: string;
  buttonVariant: 'danger' | 'primary';
  icon: React.ReactNode;
  state: OpState;
  result: Result | null;
  onAction: () => void;
}

function ActionCard({
  title,
  description,
  buttonLabel,
  buttonVariant,
  icon,
  state,
  result,
  onAction,
}: ActionCardProps) {
  const isLoading = state === 'loading';

  const buttonClass =
    buttonVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white disabled:opacity-50'
      : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white disabled:opacity-50';

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </div>

      <button
        onClick={onAction}
        disabled={isLoading}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${buttonClass}`}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          icon
        )}
        {isLoading ? 'Running…' : buttonLabel}
      </button>

      {state === 'success' && result && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
            <CheckCircle className="w-4 h-4" />
            Done
          </div>
          <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
            {Object.entries(result.counts).map(([col, count]) => (
              <li key={col}>
                <span className="font-mono">{col}</span>: {count} {result.label.toLowerCase()}
              </li>
            ))}
            {Object.keys(result.counts).length === 0 && (
              <li className="text-gray-500">No documents affected.</li>
            )}
          </ul>
        </div>
      )}

      {state === 'error' && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          Operation failed. Check the console for details.
        </div>
      )}
    </div>
  );
}
