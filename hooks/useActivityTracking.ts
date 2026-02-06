import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { activityLogger } from '@/lib/services/activityLogger';

interface UseActivityTrackingProps {
  adminId?: string;
  adminEmail?: string;
  adminName?: string;
  userAgent?: string;
  ipAddress?: string;
  enabled?: boolean;
}

export function useActivityTracking({
  adminId,
  adminEmail,
  adminName,
  userAgent,
  ipAddress,
  enabled = true
}: UseActivityTrackingProps) {
  const pathname = usePathname();
  const sessionKeyRef = useRef<string>('');

  useEffect(() => {
    if (!enabled || !adminId || !adminEmail || !adminName || !pathname) {
      return;
    }

    // Start tracking when component mounts or pathname changes
    const startTracking = async () => {
      // End previous tracking if exists
      if (sessionKeyRef.current) {
        await activityLogger.endPageView(sessionKeyRef.current);
      }

      // Start new tracking
      const sessionKey = await activityLogger.startPageView(
        adminId,
        adminEmail,
        adminName,
        pathname,
        userAgent,
        ipAddress
      );
      sessionKeyRef.current = sessionKey;
    };

    startTracking();

    // Cleanup: end tracking when component unmounts or pathname changes
    return () => {
      if (sessionKeyRef.current) {
        activityLogger.endPageView(sessionKeyRef.current);
      }
    };
  }, [pathname, adminId, adminEmail, adminName, userAgent, ipAddress, enabled]);
}