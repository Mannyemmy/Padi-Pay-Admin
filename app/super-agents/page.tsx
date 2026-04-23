'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Save, Search, Star, Users, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import { showToast } from '@/components/Toast';
import {
  BusinessSuperAgentRecord,
  SuperAgentProgramSettings,
  getBusinessSuperAgentRecords,
  getSuperAgentProgramSettingsFn,
  setBusinessSuperAgentStatusFn,
  updateSuperAgentProgramSettingsFn,
} from '@/lib/firestore';

function formatNaira(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const DEFAULT_SETTINGS: SuperAgentProgramSettings = {
  perNipTransferAmount: 5,
  verifiedBusinessBonusAmount: 5000,
  starThresholds: {
    1: 0,
    2: 10000,
    3: 30000,
    4: 70000,
    5: 150000,
  },
};

export default function SuperAgentsPage() {
  const { loading: authLoading } = useAuth();
  const [records, setRecords] = useState<BusinessSuperAgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyBusinessId, setBusyBusinessId] = useState<string | null>(null);

  const [settings, setSettings] = useState<SuperAgentProgramSettings>(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [businesses, programSettings] = await Promise.all([
        getBusinessSuperAgentRecords(),
        getSuperAgentProgramSettingsFn(),
      ]);
      setRecords(businesses);
      setSettings(programSettings);
    } catch (error) {
      console.error('Failed loading super-agent management data:', error);
      showToast('error', 'Failed to load super-agent data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredRecords = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) => {
      return (
        record.businessName.toLowerCase().includes(needle) ||
        record.businessEmail.toLowerCase().includes(needle) ||
        record.superAgentReferralCode.toLowerCase().includes(needle)
      );
    });
  }, [records, search]);

  const stats = useMemo(() => {
    const totalBusinesses = records.length;
    const superAgents = records.filter((record) => record.isSuperAgent);
    const totalSuperAgents = superAgents.length;
    const totalEarnings = superAgents.reduce(
      (sum, record) => sum + Number(record.superAgentTotalEarnings || 0),
      0,
    );

    return {
      totalBusinesses,
      totalSuperAgents,
      totalEarnings,
    };
  }, [records]);

  async function handleToggle(record: BusinessSuperAgentRecord) {
    setBusyBusinessId(record.id);
    try {
      await setBusinessSuperAgentStatusFn(record.id, !record.isSuperAgent);
      showToast(
        'success',
        !record.isSuperAgent
          ? 'Business enabled as Super Agent'
          : 'Business removed from Super Agent program',
      );
      await loadData();
    } catch (error: any) {
      console.error('Failed to update Super Agent status:', error);
      showToast('error', error?.message || 'Failed to update status');
    } finally {
      setBusyBusinessId(null);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      await updateSuperAgentProgramSettingsFn(settings);
      showToast('success', 'Super Agent program settings saved');
      await loadData();
    } catch (error: any) {
      console.error('Failed to save Super Agent program settings:', error);
      showToast('error', error?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  }

  function updateThreshold(star: 1 | 2 | 3 | 4 | 5, value: string) {
    const numeric = Number(value || 0);
    setSettings((prev) => ({
      ...prev,
      starThresholds: {
        ...prev.starThresholds,
        [star]: Number.isNaN(numeric) ? 0 : numeric,
      },
    }));
  }

  if (authLoading || loading) {
    return <Loading message="Loading super-agent management..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Agent Program"
        description="Manage business-account super agents, referral rewards, and star thresholds"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Business Accounts"
          value={stats.totalBusinesses.toLocaleString()}
          icon={<Users className="h-5 w-5" />}
          color="blue"
        />
        <StatsCard
          title="Active Super Agents"
          value={stats.totalSuperAgents.toLocaleString()}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="green"
        />
        <StatsCard
          title="Total Super Agent Earnings"
          value={formatNaira(stats.totalEarnings)}
          icon={<Star className="h-5 w-5" />}
          color="purple"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Reward Configuration</h2>
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NIP Commission Per Transfer (NGN)
            </label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              value={settings.perNipTransferAmount}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  perNipTransferAmount: Number(event.target.value || 0),
                }))
              }
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verified Business Bonus (NGN)
            </label>
            <input
              type="number"
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              value={settings.verifiedBusinessBonusAmount}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  verifiedBusinessBonusAmount: Number(event.target.value || 0),
                }))
              }
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Star Thresholds (By Total Commission Earnings)</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <div key={star}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{star} Star</label>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={settings.starThresholds[star as 1 | 2 | 3 | 4 | 5]}
                  onChange={(event) =>
                    updateThreshold(star as 1 | 2 | 3 | 4 | 5, event.target.value)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by business name, email, or referral code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Business</th>
                <th className="text-left px-4 py-3 font-semibold">Referral Code</th>
                <th className="text-left px-4 py-3 font-semibold">Stars</th>
                <th className="text-left px-4 py-3 font-semibold">Total Earnings</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => {
                const isBusy = busyBusinessId === record.id;
                return (
                  <tr key={record.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{record.businessName || 'Unnamed Business'}</p>
                      <p className="text-gray-500">{record.businessEmail || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{record.superAgentReferralCode || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{record.superAgentStars || 0}</td>
                    <td className="px-4 py-3 text-gray-700">{formatNaira(record.superAgentTotalEarnings || 0)}</td>
                    <td className="px-4 py-3">
                      {record.isSuperAgent ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                          <XCircle className="h-3.5 w-3.5" /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(record)}
                        disabled={isBusy}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white ${
                          record.isSuperAgent
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-blue-600 hover:bg-blue-700'
                        } disabled:opacity-60`}
                      >
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {record.isSuperAgent ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No business accounts found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
