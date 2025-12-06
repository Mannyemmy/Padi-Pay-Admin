'use client';

import { useEffect, useState } from 'react';
import { Search, Plus, X, Shield, HeadphonesIcon, Mail, Lock, Trash2 } from 'lucide-react';
import { Admin, AdminRole } from '@/lib/types';
import { getAdmins, upsertAdminProfile, deleteAdmin } from '@/lib/firestore';
import { createAdminAccount, triggerPasswordReset, deleteAdminAccount, updateAdminAccount } from '@/lib/auth';

const roleIcons: Record<AdminRole, typeof Shield> = {
  admin: Shield,
  customer_service: HeadphonesIcon,
};

const roleColors: Record<AdminRole, string> = {
  admin: 'bg-purple-100 text-purple-800',
  customer_service: 'bg-blue-100 text-blue-800',
};

const rolePermissions: Record<AdminRole, Record<string, boolean>> = {
  admin: {
    canViewDashboard: true,
    canManageUsers: true,
    canManageTransactions: true,
    canManageAdmins: true,
    canEditSettings: true,
  },
  customer_service: {
    canViewDashboard: true,
    canManageUsers: true,
    canManageTransactions: false,
    canManageAdmins: false,
    canEditSettings: false,
  },
};

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    role: 'customer_service' as AdminRole,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);

  const loadAdmins = async () => {
    try {
      const data = await getAdmins();
      console.log('Loaded admins:', data);
      setAdmins(data);
    } catch (err) {
      console.error('Error loading admins:', err);
      setError('Failed to load admins');
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const handleAddAdmin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const uid = await createAdminAccount({
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
      });
      if (!uid) {
        setError('Could not create admin account');
      } else {
        await loadAdmins();
      }
      setShowAddModal(false);
      setNewAdmin({ name: '', email: '', role: 'customer_service' });
    } catch (err: any) {
      setError(err.message || 'Failed to add admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (adminId: string, role: AdminRole) => {
    await upsertAdminProfile(adminId, { role });
    await loadAdmins();
  };

  const handleSaveProfile = async () => {
    if (!editingAdmin) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateAdminAccount(editingAdmin.id, {
        name: editingAdmin.name,
        email: editingAdmin.email,
      });
      await loadAdmins();
      setEditingAdmin(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    await triggerPasswordReset(email);
  };

  const handleDelete = async (adminId: string) => {
    await deleteAdminAccount(adminId);
    await deleteAdmin(adminId);
    await loadAdmins();
  };

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Management</h1>
          <p className="text-gray-500 mt-1">Manage admin users and permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Admin
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Admins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAdmins.map((admin) => {
          const RoleIcon = roleIcons[admin.role];
          const permissions = rolePermissions[admin.role];

          return (
            <div key={admin.id} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-lg">
                      {admin.name?.charAt(0) || 'A'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{admin.name}</h3>
                    <p className="text-sm text-gray-500">{admin.email}</p>
                  </div>
                </div>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    admin.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {admin.status}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${roleColors[admin.role]}`}>
                  <RoleIcon className="w-4 h-4" />
                  <span className="text-sm font-medium capitalize">
                    {admin.role.replace('_', ' ')}
                  </span>
                </div>
                <select
                  value={admin.role}
                  onChange={(e) => handleUpdateRole(admin.id, e.target.value as AdminRole)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="admin">Admin</option>
                  <option value="customer_service">Customer Service</option>
                </select>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-gray-500">Permissions:</p>
                <div className="space-y-1">
                  {Object.entries(permissions).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${value ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-xs text-gray-600">
                        {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Mail className="w-4 h-4 text-gray-400" />
                <span>
                  Last login:{' '}
                  {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Never'}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setEditingAdmin(admin)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Shield className="w-4 h-4" />
                  Edit profile
                </button>
                <button
                  onClick={() => handleResetPassword(admin.email)}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Lock className="w-4 h-4" />
                  Reset password
                </button>
                <button
                  onClick={() => handleDelete(admin.id)}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add New Admin</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={newAdmin.name}
                  onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={newAdmin.role}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, role: e.target.value as AdminRole })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="customer_service">Customer Service</option>
                </select>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Permissions for {newAdmin.role.replace('_', ' ')}:
                </p>
                <div className="space-y-1">
                  {Object.entries(rolePermissions[newAdmin.role]).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          value ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                      <span className="text-xs text-blue-800">
                        {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAdmin}
                  disabled={submitting}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Adding...' : 'Add Admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingAdmin(null)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Edit Admin</h2>
              <button
                onClick={() => setEditingAdmin(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={editingAdmin?.name ?? ''}
                  onChange={(e) =>
                    setEditingAdmin((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={editingAdmin?.email ?? ''}
                  onChange={(e) =>
                    setEditingAdmin((prev) => (prev ? { ...prev, email: e.target.value } : prev))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setEditingAdmin(null)}
                  className="flex-1 py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={submitting}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Logs Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {[
              {
                admin: 'Admin User',
                action: 'Updated user status',
                target: 'John Doe',
                time: '2 hours ago',
              },
              {
                admin: 'John Support',
                action: 'Approved withdrawal',
                target: 'TXN-001',
                time: '3 hours ago',
              },
              {
                admin: 'Jane Finance',
                action: 'Modified interest rate',
                target: 'Settings',
                time: '5 hours ago',
              },
              {
                admin: 'Admin User',
                action: 'Added new admin',
                target: 'Mike Viewer',
                time: '1 day ago',
              },
            ].map((log, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">
                    {log.admin.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{log.admin}</span> {log.action}{' '}
                    <span className="font-medium">{log.target}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
