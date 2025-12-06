'use client';

import { useMemo, useState } from 'react';
import { Megaphone, Send, Mail, Phone, MessageSquare, History, Users, CheckCircle, Trash2 } from 'lucide-react';
import { Communication } from '@/lib/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EmptyState } from '@/components/EmptyState';
import { showToast } from '@/components/Toast';

const defaultAudience = 'All users';

// Create sample communications with proper date handling
const createSampleCommunications = (): Communication[] => [
  {
    id: 'cm-1001',
    title: 'Onboarding nudge',
    body: 'Complete your KYC to unlock higher limits.',
    audience: 'KYC-pending users',
    channels: ['email', 'sms'],
    status: 'sent',
    sentAt: new Date(),
    createdBy: 'Support',
  },
  {
    id: 'cm-1000',
    title: 'Outage notice',
    body: 'Card services were degraded between 1:00 PM - 1:30 PM. Resolved now.',
    audience: 'All users',
    channels: ['email'],
    status: 'sent',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    createdBy: 'Admin',
  },
];

const presetMessages = [
  {
    title: 'Scheduled maintenance',
    body: 'We will perform maintenance tonight at 11:00 PM. Service may be intermittently unavailable.',
  },
  {
    title: 'Security reminder',
    body: 'Never share your OTP or PIN with anyone. PadiPay will never ask for this information.',
  },
  {
    title: 'New feature',
    body: 'Check out the new business dashboard. Update your app to the latest version to access it.',
  },
];

export default function CommunicationsPage() {
  const [form, setForm] = useState<{ title: string; body: string; audience: string; channels: Array<'email' | 'sms' | 'call'> }>(
    {
      title: '',
      body: '',
      audience: defaultAudience,
      channels: ['email'],
    }
  );

  const [communications, setCommunications] = useState<Communication[]>(createSampleCommunications());
  const [confirmSend, setConfirmSend] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const sendDisabled = !form.title.trim() || !form.body.trim() || form.channels.length === 0;

  const handleSend = () => {
    if (sendDisabled) return;

    const newEntry: Communication = {
      id: `cm-${Date.now()}`,
      title: form.title.trim(),
      body: form.body.trim(),
      audience: form.audience.trim() || defaultAudience,
      channels: form.channels,
      status: 'sent',
      sentAt: new Date(),
      createdBy: 'You',
    };

    setCommunications((prev) => [newEntry, ...prev]);
    setForm({ ...form, title: '', body: '' });
    setConfirmSend(false);
    showToast('success', 'Communication sent!', `Message sent to ${form.audience} via ${form.channels.join(', ')}.`);
  };

  const handleDelete = (id: string) => {
    setCommunications((prev) => prev.filter((c) => c.id !== id));
    setDeleteConfirm(null);
    showToast('success', 'Communication deleted', 'The communication has been removed.');
  };

  const channelLabel = (channel: 'email' | 'sms' | 'call') => {
    if (channel === 'email') return 'Email';
    if (channel === 'sms') return 'SMS';
    return 'Phone Call';
  };

  const recentByChannel = useMemo(() => {
    return {
      email: communications.find((c) => c.channels.includes('email')),
      sms: communications.find((c) => c.channels.includes('sms')),
      call: communications.find((c) => c.channels.includes('call')),
    };
  }, [communications]);

  const toggleChannel = (channel: 'email' | 'sms' | 'call') => {
    setForm((prev) => {
      const exists = prev.channels.includes(channel);
      return {
        ...prev,
        channels: exists ? prev.channels.filter((c) => c !== channel) : [...prev.channels, channel],
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Communications</h1>
          <p className="text-gray-500 mt-1">Send announcements to users via email, SMS, or phone calls.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-200 px-3 py-2 rounded-lg">
          <Users className="w-4 h-4" />
          <span>Admin & Customer Service access</span>
        </div>
      </div>

      {/* Composer */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">New Announcement</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Eg. Service update"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[140px]"
                placeholder="Write the announcement..."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Audience</label>
                <select
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>All users</option>
                  <option>Active users</option>
                  <option>KYC-pending users</option>
                  <option>Businesses</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-gray-700 mb-2">Channels</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => toggleChannel('email')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                      form.channels.includes('email') ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    <Mail className="w-4 h-4" /> Email
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleChannel('sms')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                      form.channels.includes('sms') ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" /> SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleChannel('call')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                      form.channels.includes('call') ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    <Phone className="w-4 h-4" /> Phone Call
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Delivery uses Email/SMS/Call providers. Wire your integrations to send.
              </div>
              <button
                onClick={() => setConfirmSend(true)}
                disabled={sendDisabled}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5"
              >
                <Send className="w-4 h-4" />
                Send & Record
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-gray-500" />
                <p className="text-sm font-semibold text-gray-900">Recent by Channel</p>
              </div>
              <div className="space-y-2 text-sm">
                {(['email', 'sms', 'call'] as Array<'email' | 'sms' | 'call'>).map((ch) => (
                  <div key={ch} className="flex items-center justify-between">
                    <span className="text-gray-600">{channelLabel(ch)}</span>
                    <span className="text-gray-900 font-medium">
                      {recentByChannel[ch]?.title || 'No sends yet'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Templates</p>
              <div className="space-y-2">
                {presetMessages.map((preset) => (
                  <button
                    key={preset.title}
                    onClick={() => setForm({ ...form, title: preset.title, body: preset.body })}
                    className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-sm"
                  >
                    {preset.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Past Communications</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track what was sent to whom</p>
        </div>
        {communications.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="w-12 h-12" />}
            title="No communications yet"
            description="Send your first announcement to get started"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Audience</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Channels</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Sent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">By</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                {communications.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors animate-in fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.title}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.audience}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.channels.map((ch) => (
                          <span key={ch} className="px-2 py-1 text-xs rounded-full badge badge-info">
                            {channelLabel(ch)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full badge badge-${
                        item.status === 'sent'
                          ? 'success'
                          : item.status === 'scheduled'
                          ? 'pending'
                          : 'info'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {item.sentAt ? new Date(item.sentAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.createdBy || 'System'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDeleteConfirm(item.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={confirmSend}
        type="confirm"
        title="Send announcement?"
        message={`Send "${form.title}" to ${form.audience} via ${form.channels.join(', ')}?`}
        confirmLabel="Send"
        cancelLabel="Cancel"
        onConfirm={handleSend}
        onCancel={() => setConfirmSend(false)}
      />

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        type="danger"
        title="Delete communication?"
        message="This action cannot be undone. The communication record will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (deleteConfirm) {
            handleDelete(deleteConfirm);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
