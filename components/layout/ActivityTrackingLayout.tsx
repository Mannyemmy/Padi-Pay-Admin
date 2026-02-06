'use client';

import { useActivityTracking } from '@/hooks/useActivityTracking';
import { useSession } from '@/hooks/useSession';

interface ActivityTrackingLayoutProps {
  children: React.ReactNode;
}

export default function ActivityTrackingLayout({ children }: ActivityTrackingLayoutProps) {
  const { admin, userAgent, ipAddress } = useSession();

  useActivityTracking({
    adminId: admin?.id,
    adminEmail: admin?.email,
    adminName: admin?.name,
    userAgent,
    ipAddress,
    enabled: !!admin
  });

  return <>{children}</>;
}