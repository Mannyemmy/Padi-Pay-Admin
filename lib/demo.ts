'use client';

import { usePathname } from 'next/navigation';

export const DEMO_PREFIX = '/admin/v2';

/**
 * Hook to detect if the current page is in demo mode.
 * Pages accessed via /admin/v2/* show only mock data.
 */
export function useDemoMode(): boolean {
  const pathname = usePathname();
  return pathname.startsWith(DEMO_PREFIX);
}

/** Prefix a standard route with the demo prefix */
export function toDemoPath(path: string): string {
  if (path.startsWith(DEMO_PREFIX)) return path;
  return `${DEMO_PREFIX}${path}`;
}

/** Strip the demo prefix to get the base route */
export function fromDemoPath(path: string): string {
  if (!path.startsWith(DEMO_PREFIX)) return path;
  return path.slice(DEMO_PREFIX.length) || '/';
}
