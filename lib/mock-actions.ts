'use client';

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

/** Call the Cloud Function to generate mock data */
export async function triggerGeneration(config?: Record<string, number>) {
  const fn = httpsCallable(functions, 'triggerMockDataGeneration');
  const result = await fn(config || {});
  return result.data as { success: boolean; created: Record<string, number> };
}

/** Call the Cloud Function to delete all mock data */
export async function triggerCleanup() {
  const fn = httpsCallable(functions, 'triggerMockDataCleanup');
  const result = await fn({});
  return result.data as { success: boolean; deleted: Record<string, number> };
}
