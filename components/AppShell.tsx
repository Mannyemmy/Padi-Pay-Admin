'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { DEMO_PREFIX } from '@/lib/demo';

const roleAccess: Record<string, Array<'admin' | 'customer_service' | 'compliance_officer'>> = {
  '/': ['admin', 'customer_service', 'compliance_officer'],
  '/users': ['admin', 'customer_service', 'compliance_officer'],
  '/users/': ['admin', 'customer_service', 'compliance_officer'],
  '/admins': ['admin'],
  '/admins/': ['admin'],
  '/agents': ['admin'],
  '/agents/': ['admin'],
  '/support-tickets': ['admin', 'customer_service', 'compliance_officer'],
  '/support-tickets/': ['admin', 'customer_service', 'compliance_officer'],
  '/transactions': ['admin', 'customer_service', 'compliance_officer'],
  '/communications': ['admin', 'customer_service', 'compliance_officer'],
  '/communications/': ['admin', 'customer_service', 'compliance_officer'],
  '/settings': ['admin'],
};

function pathAllowed(pathname: string, role?: 'admin' | 'customer_service' | 'compliance_officer') {
  if (!role) return false;
  // Strip /admin/v2 prefix for permission checking
  const basePath = pathname.startsWith(DEMO_PREFIX) ? (pathname.slice(DEMO_PREFIX.length) || '/') : pathname;
  const entries = Object.entries(roleAccess);
  for (const [prefix, roles] of entries) {
    if (basePath === prefix || basePath.startsWith(prefix + '/')) {
      return roles.includes(role);
    }
  }
  // Default to admin only for unspecified routes
  return role === 'admin';
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, admin, loading, refreshAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === '/login';
  const isInspect = pathname === '/inspect';

  useEffect(() => {
    if (loading) return;
    if (!user && !isLogin && !isInspect) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [user, isLogin, isInspect, loading, pathname, router]);

  useEffect(() => {
    if (loading || !user || isLogin || isInspect || !admin?.role) return;
    const allowed = pathAllowed(pathname, admin.role);
    if (!allowed) {
      router.replace('/');
    }
  }, [admin?.role, user, loading, pathname, router, isLogin, isInspect]);

  // If admin doc loaded but role is missing, the doc was fetched mid-write — retry.
  useEffect(() => {
    if (!loading && user && admin && !admin.role) {
      refreshAdmin();
    }
  }, [loading, user, admin, refreshAdmin]);

  if (isLogin || isInspect) {
    return <div className="min-h-screen bg-gray-50">{children}</div>;
  }

  if (loading || (!user && !isLogin) || (user && !admin && !isLogin) || (user && admin && !admin.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loading />
      </div>
    );
  }

  // If an admin profile exists but the `role` field is missing, refreshAdmin() above handles it.
  // Fallback: should not normally be reached.

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
