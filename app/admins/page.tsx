"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  X,
  Shield,
  HeadphonesIcon,
  Mail,
  Lock,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Save,
  UserPlus,
  AlertTriangle,
  MailCheck,
  UserX,
} from "lucide-react";
import { Admin, AdminRole, AdminRoute } from "@/lib/types";
import { getAdmins, upsertAdminProfile, deleteAdmin } from "@/lib/firestore";
import {
  createAdminAccount,
  triggerPasswordReset,
  deleteAdminAccount,
  updateAdminAccount,
} from "@/lib/auth";
import { allRoutes, defaultRolePermissions } from "@/lib/routes";

// Role icons and colors
const roleIcons: Record<AdminRole, typeof Shield> = {
  admin: Shield,
  customer_service: HeadphonesIcon,
  compliance_officer: Shield,
};

const roleColors: Record<AdminRole, string> = {
  admin: "bg-purple-100 text-purple-800 border-purple-200",
  customer_service: "bg-blue-100 text-blue-800 border-blue-200",
  compliance_officer: "bg-green-100 text-green-800 border-green-200",
};

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalContent, setModalContent] = useState<{
    type: "add" | "delete" | "success"| "error";
    title: string;
    message: string;
    adminEmail?: string;
    adminId?: string;
    adminName?: string;
    temporaryPassword?: string;
  } | null>(null);

  const [newAdmin, setNewAdmin] = useState({
    name: "",
    email: "",
    role: "customer_service" as AdminRole,
  });

  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  // Group routes by category
  const groupedRoutes = allRoutes.reduce(
    (acc, route) => {
      const category = route.category || "Other";
      if (!acc[category]) acc[category] = [];
      acc[category].push(route);
      return acc;
    },
    {} as Record<string, typeof allRoutes>,
  );

  // Initialize expanded categories
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    Object.keys(groupedRoutes).forEach((category) => {
      initialExpanded[category] = true;
    });
    setExpandedCategories(initialExpanded);
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const data = await getAdmins();
      const adminsWithPermissions = data.map((admin) => ({
        ...admin,
        permissions: admin.permissions || defaultRolePermissions[admin.role],
      }));
      setAdmins(adminsWithPermissions);
    } catch (err) {
      console.error("Error loading admins:", err);
      setError("Failed to load admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const showModal = (
    type: "add" | "delete" | "success"| "error",
    config: {
      title: string;
      message: string;
      adminEmail?: string;
      adminId?: string;
      adminName?: string;
      temporaryPassword?: string;
    },
  ) => {
    setModalContent({
      type,
      ...config,
    });
  };

  const closeModal = () => {
    setModalContent(null);
    setAdminToDelete(null);
  };

  const handleAddAdmin = async () => {
    if (!newAdmin.name.trim() || !newAdmin.email.trim()) {
      setError("Name and email are required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createAdminAccount({
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
      });

      

      // Show success modal with password info
      showModal("success", {
        title: "Admin Created Successfully",
        message: `New admin account has been created for ${newAdmin.name}.`,
        adminEmail: newAdmin.email,
       
      });

      // Refresh admin list
      await loadAdmins();

      // Reset form
      setNewAdmin({ name: "", email: "", role: "customer_service" });
      setShowAddModal(false);

      // Send password reset email
      try {
        await triggerPasswordReset(newAdmin.email);
        console.log("Password reset email sent to:", newAdmin.email);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
      }
    } catch (err: any) {
      setError(err.message || "Failed to add admin");
      showModal("error", {
        title: "Error Creating Admin",
        message: err.message || "Failed to create admin account",
      });
    } finally {
      setSubmitting(false);
    }
  };
  const handleDeleteClick = (admin: Admin) => {
  if (admin.role === "admin") {
    setError("Cannot delete administrator accounts");
    return;
  }

  setAdminToDelete(admin);
  setModalContent({
    type: "delete",
    title: "Delete Admin",
    message: `Are you sure you want to delete ${admin.name}? This action cannot be undone.`,
    adminId: admin.id,
    adminName: admin.name,
    adminEmail: admin.email,
  });
};

  const handleDeleteConfirm = async () => {
    if (!adminToDelete) return;

    try {
      await deleteAdminAccount(adminToDelete.id);
      await deleteAdmin(adminToDelete.id);

      // Refresh admin list
      await loadAdmins();

      // Show success message in modal
      showModal("success", {
        title: "Admin Deleted",
        message: `${adminToDelete.name} has been successfully deleted.`,
      });

      setAdminToDelete(null);
    } catch (err: any) {
      setError(err.message || "Failed to delete admin");
      showModal("error", {
        title: "Error Deleting Admin",
        message: err.message || "Failed to delete admin account",
      });
    }
  };


  const handleUpdatePermissions = async (
    adminId: string,
    route: AdminRoute,
    allowed: boolean,
  ) => {
    try {
      const admin = admins.find((a) => a.id === adminId);
      if (!admin || !admin.permissions) return;

      const updatedPermissions = {
        ...admin.permissions,
        [route]: allowed,
      };

      await upsertAdminProfile(adminId, { permissions: updatedPermissions });
      
      await loadAdmins();
    } catch (err) {
      console.error("Error updating permissions:", err);
      setError("Failed to update permissions");
    }
  };

  const handleUpdateAllPermissions = async (
    adminId: string,
    allowed: boolean,
  ) => {
    try {
      const admin = admins.find((a) => a.id === adminId);
      if (!admin || !admin.permissions) return;

      const updatedPermissions = Object.keys(admin.permissions).reduce(
        (acc, key) => {
          acc[key as AdminRoute] = allowed;
          return acc;
        },
        {} as Record<AdminRoute, boolean>,
      );

      await upsertAdminProfile(adminId, { permissions: updatedPermissions });
      await loadAdmins();
    } catch (err) {
      console.error("Error updating all permissions:", err);
      setError("Failed to update permissions");
    }
  };

  const handleResetToDefaultPermissions = async (
    adminId: string,
    role: AdminRole,
  ) => {
    try {
      await upsertAdminProfile(adminId, {
        permissions: defaultRolePermissions[role],
      });
      await loadAdmins();
    } catch (err) {
      console.error("Error resetting permissions:", err);
      setError("Failed to reset permissions");
    }
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

      if (editingAdmin.permissions) {
        await upsertAdminProfile(editingAdmin.id, {
          permissions: editingAdmin.permissions,
        });
        
      }

      setSaveStatus("success");
      setTimeout(() => {
        setEditingAdmin(null);
        setSaveStatus("idle");
      }, 1500);

      await loadAdmins();
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
      setSaveStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await triggerPasswordReset(email);
      showModal("success", {
        title: "Password Reset Email Sent",
        message: `A password reset link has been sent to ${email}.`,
        adminEmail: email,
      });
    } catch (err: any) {
      setError(err.message || "Failed to send reset email");
      showModal("error", {
        title: "Error Sending Email",
        message: err.message || "Failed to send password reset email",
      });
    }
  };

  const filteredAdmins = admins.filter(
    (admin) =>
      admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Render modals based on modalContent type
  const renderModal = () => {
    if (!modalContent) return null;

    const { type, title, message, adminEmail, adminName, temporaryPassword } =
      modalContent;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {type === "success" && (
                <div className="p-2 bg-green-100 rounded-lg">
                  <Check className="w-6 h-6 text-green-600" />
                </div>
              )}
              {type === "delete" && (
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              )}
              {type === "add" && (
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UserPlus className="w-6 h-6 text-blue-600" />
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            </div>
            <button
              onClick={closeModal}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-gray-600">{message}</p>

            {adminEmail && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail className="w-4 h-4" />
                  <span className="font-medium">Email:</span>
                  <span>{adminEmail}</span>
                </div>
              </div>
            )}

            {temporaryPassword && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm text-yellow-800 mb-2">
                  <Lock className="w-4 h-4" />
                  <span className="font-medium">Password Reset:</span>
                </div>
                <p className="text-sm text-yellow-700">
                  A password reset email has been sent to the admin. They must
                  use the link to set their password.
                </p>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              {type === "delete" ? (
                <>
                  <button
                    onClick={closeModal}
                    className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Delete Admin
                  </button>
                </>
              ) : (
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {type === "success" ? "Done" : "Close"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Management</h1>
          <p className="text-gray-500 mt-1">
            Manage admin users and their page access permissions
          </p>
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
          placeholder="Search admins by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Admins Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
            >
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredAdmins.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No admins found
          </h3>
          <p className="text-gray-500 mb-6">
            {searchTerm
              ? "Try adjusting your search terms"
              : "Add your first admin to get started"}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Admin
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAdmins.map((admin) => {
            const RoleIcon = roleIcons[admin.role];
            const permissions =
              admin.permissions || defaultRolePermissions[admin.role];

            const accessibleRoutesCount =
              Object.values(permissions).filter(Boolean).length;
            const totalRoutesCount = Object.keys(permissions).length;

            return (
              <div
                key={admin.id}
                className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 hover:shadow-lg transition-shadow"
              >
                {/* Admin Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-lg">
                        {admin.name?.charAt(0) || "A"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {admin.name}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">
                        {admin.email}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${roleColors[admin.role]}`}
                        >
                          <RoleIcon className="w-3 h-3" />
                          {admin.role.replace("_", " ")}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            admin.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {admin.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Access Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      Page Access
                    </p>
                    <span className="text-xs font-semibold text-blue-600">
                      {accessibleRoutesCount}/{totalRoutesCount} routes
                    </span>
                  </div>
                  <div className="space-y-2">
                    {allRoutes.slice(0, 3).map((route) => (
                      <div
                        key={route.href}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <route.icon className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-xs text-gray-600 truncate">
                            {route.name}
                          </span>
                        </div>
                        {permissions[route.href] ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300" />
                        )}
                      </div>
                    ))}
                    {allRoutes.length > 3 && (
                      <p className="text-xs text-gray-500 text-center pt-1">
                        +{allRoutes.length - 3} more pages
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setEditingAdmin(admin)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleResetPassword(admin.email)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                  >
                    <Lock className="w-4 h-4" />
                    Reset Password
                  </button>
                  {admin.role !== "admin" && (
                    <button
                      onClick={() => handleDeleteClick(admin)}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Last Login */}
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>
                      Last login:{" "}
                      {admin.lastLoginAt ? (
                        <span className="text-gray-700">
                          {new Date(admin.lastLoginAt).toLocaleDateString()} at{" "}
                          {new Date(admin.lastLoginAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UserPlus className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Add New Admin
                </h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <MailCheck className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Password Reset Email
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      After creating the admin account, a password reset email
                      will be automatically sent to their email address.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newAdmin.name}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={newAdmin.email}
                  onChange={(e) =>
                    setNewAdmin({ ...newAdmin, email: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  value={newAdmin.role}
                  onChange={(e) =>
                    setNewAdmin({
                      ...newAdmin,
                      role: e.target.value as AdminRole,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="admin">Administrator (Full Access)</option>
                  <option value="customer_service">Customer Service</option>
                  <option value="compliance_officer">Compliance Officer</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAdmin}
                  disabled={
                    submitting ||
                    !newAdmin.name.trim() ||
                    !newAdmin.email.trim()
                  }
                  className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? "Creating..." : "Add Admin"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditingAdmin(null)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0 ">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Manage Access
                </h2>
                <p className="text-gray-600 mt-1">
                  {editingAdmin.name} • {editingAdmin.email}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {saveStatus === "success" && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    <Check className="w-4 h-4" />
                    Saved successfully!
                  </span>
                )}
                <button
                  onClick={() => setEditingAdmin(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Admin Info */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Profile Card */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Admin Profile
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={editingAdmin.name}
                          onChange={(e) =>
                            setEditingAdmin((prev) =>
                              prev ? { ...prev, name: e.target.value } : prev,
                            )
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={editingAdmin.email}
                          onChange={(e) =>
                            setEditingAdmin((prev) =>
                              prev ? { ...prev, email: e.target.value } : prev,
                            )
                          }
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Role
                        </label>
                        <select
                          value={editingAdmin.role}
                          onChange={(e) => {
                            const newRole = e.target.value as AdminRole;
                            setEditingAdmin((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    role: newRole,
                                    permissions:
                                      defaultRolePermissions[newRole],
                                  }
                                : prev,
                            );
                          }}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="admin">Administrator</option>
                          <option value="customer_service">
                            Customer Service
                          </option>
                          <option value="compliance_officer">
                            Compliance Officer
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions Card */}
                  <div className="rounded-xl border border-blue-100 p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">
                      Quick Actions
                    </h3>
                    <div className="space-y-3">
                      <button
                        onClick={() =>
                          handleResetToDefaultPermissions(
                            editingAdmin.id,
                            editingAdmin.role,
                          )
                        }
                        className="w-full flex items-center justify-between px-4 py-3 bg-white text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                      >
                        <span className="font-medium">
                          Reset to default permissions
                        </span>
                        <Shield className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          handleResetPassword(editingAdmin.email);
                          alert("Password reset email sent!");
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 bg-white text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
                      >
                        <span className="font-medium">Send password reset</span>
                        <Lock className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column - Route Permissions */}
                <div className="lg:col-span-2">
                  <div className="brounded-xl border overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-gray-200 ">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            Page Access Control
                          </h3>
                          <p className="text-gray-600 mt-1">
                            Toggle access to specific admin pages
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <button
                            onClick={() =>
                              handleUpdateAllPermissions(editingAdmin.id, true)
                            }
                            className="px-4 py-2.5 bg-green-100 text-green-800 rounded-lg font-medium hover:bg-green-200 transition-colors"
                          >
                            Allow All
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateAllPermissions(editingAdmin.id, false)
                            }
                            className="px-4 py-2.5 bg-red-100 text-red-800 rounded-lg font-medium hover:bg-red-200 transition-colors"
                          >
                            Deny All
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            {
                              Object.values(
                                editingAdmin.permissions || {},
                              ).filter(Boolean).length
                            }{" "}
                            /{" "}
                            {Object.keys(editingAdmin.permissions || {}).length}{" "}
                            pages allowed
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {Object.entries(groupedRoutes).map(
                        ([category, routes]) => (
                          <div key={category}>
                            <button
                              onClick={() => toggleCategory(category)}
                              className="w-full p-5 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <span className="font-medium text-gray-900">
                                  {category}
                                </span>
                                <span className="text-sm bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                                  {routes.length} pages
                                </span>
                              </div>
                              {expandedCategories[category] ? (
                                <ChevronUp className="w-5 h-5 text-gray-500" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                              )}
                            </button>

                            {expandedCategories[category] && (
                              <div className="p-5 pt-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {routes.map((route) => {
                                    const isAllowed =
                                      editingAdmin.permissions?.[route.href] ??
                                      false;
                                    return (
                                      <div
                                        key={route.href}
                                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                          isAllowed
                                            ? "border-green-200 bg-green-400"
                                            : "border-gray-200 bg-red-400"
                                        } hover:shadow-sm`}
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div
                                            className={`p-2 rounded-lg ${
                                              isAllowed
                                                ? "bg-green-100 text-green-600"
                                                : "bg-gray-100 text-gray-500"
                                            }`}
                                          >
                                            <route.icon className="w-4 h-4" />
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium text-white truncate">
                                              {route.name}
                                            </p>
                                            {/* <p className="text-xs text-white truncate">{route.href}</p> */}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() =>
                                            handleUpdatePermissions(
                                              editingAdmin.id,
                                              route.href,
                                              !isAllowed,
                                            )
                                          }
                                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                            isAllowed
                                              ? "bg-green-800"
                                              : "bg-gray-300"
                                          }`}
                                        >
                                          <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                              isAllowed
                                                ? "translate-x-6"
                                                : "translate-x-1"
                                            }`}
                                          />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-6 flex-shrink-0 bg-gray-50">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setEditingAdmin(null)}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-white transition-colors font-medium"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-4">
                  {error && (
                    <span className="text-sm text-red-600">{error}</span>
                  )}
                  <button
                    onClick={handleSaveProfile}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        {modalContent && renderModal()}
    </div>
  );
}
