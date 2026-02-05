'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';

const roleAccess: Record<string, Array<'admin' | 'customer_service' | 'compliance_officer'>> = {
  '/': ['admin', 'customer_service', 'compliance_officer'],
  '/users': ['admin', 'customer_service', 'compliance_officer'],
  '/users/': ['admin', 'customer_service', 'compliance_officer'],
  '/admins': ['admin'],
  '/admins/': ['admin'],
  '/agents': ['admin'],
  '/agents/': ['admin'],
  '/transactions': ['admin', 'customer_service', 'compliance_officer'],
  '/communications': ['admin', 'customer_service', 'compliance_officer'],
  '/communications/': ['admin', 'customer_service', 'compliance_officer'],
  '/settings': ['admin'],
};

function pathAllowed(pathname: string, role?: 'admin' | 'customer_service' | 'compliance_officer') {
  if (!role) return false;
  const entries = Object.entries(roleAccess);
  for (const [prefix, roles] of entries) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return roles.includes(role);
    }
  }
  // Default to admin only for unspecified routes
  return role === 'admin';
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, admin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (loading) return;
    if (!user && !isLogin) {
      router.replace('/login');
    }
  }, [user, isLogin, loading, router]);

  useEffect(() => {
    if (loading || !user || isLogin || !admin?.role) return;
    const allowed = pathAllowed(pathname, admin.role);
    if (!allowed) {
      router.replace('/');
    }
  }, [admin?.role, user, loading, pathname, router, isLogin]);

  if (isLogin) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  if (loading || (!user && !isLogin)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loading />
      </div>
    );
  }

  if (user && !admin && !isLogin) {
    router.refresh();
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Role not assigned</p>
          <p className="text-sm text-gray-500">Your account does not have a role yet. Please contact an administrator.</p>
        </div>
      </div>
    );
  }

  // If an admin profile exists but the `role` field is missing, show a clearer message to help debugging.
  if (user && admin && !admin.role && !isLogin) {
    // Helpful console log for debugging in the browser
    // eslint-disable-next-line no-console
    console.log('Auth admin without role:', admin);

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Role not assigned</p>
          <p className="text-sm text-gray-500">
            Your account has an admin profile but no role assigned. Please contact a super-admin to assign a role.
            <br />
            <span className="text-xs text-gray-400">Admin id: {admin.id}</span>
          </p>
        </div>
      </div>
    );
  }

  if (!pathAllowed(pathname, admin?.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Access denied</p>
          <p className="text-sm text-gray-500">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-6">{children}</div>
      </main>
    </div>
  );
}
