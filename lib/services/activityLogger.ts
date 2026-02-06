import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  limit
} from 'firebase/firestore';
import { ActivityLog } from '../types';

class ActivityLogger {
  private static instance: ActivityLogger;
  private activeLogs: Map<string, string> = new Map(); // sessionId -> logId

  private constructor() {}

  static getInstance(): ActivityLogger {
    if (!ActivityLogger.instance) {
      ActivityLogger.instance = new ActivityLogger();
    }
    return ActivityLogger.instance;
  }

  /**
   * Start tracking a page view
   */
  async startPageView(
    adminId: string,
    adminEmail: string,
    adminName: string,
    route: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<string> {
    try {
      const logData: Omit<ActivityLog, 'id'> = {
        adminId,
        adminEmail,
        adminName,
        route,
        action: 'page_view',
        startTime: Date.now(),
        userAgent,
        ipAddress,
        createdAt: Date.now()
      };

      const docRef = await addDoc(collection(db, 'activityLogs'), logData);
      
      // Store the log ID with session key
      const sessionKey = `${adminId}_${route}_${Date.now()}`;
      this.activeLogs.set(sessionKey, docRef.id);
      
      return sessionKey;
    } catch (error) {
      console.error('Error starting page view log:', error);
      return '';
    }
  }

  /**
   * End tracking a page view and calculate duration
   */
  async endPageView(sessionKey: string): Promise<void> {
    try {
      const logId = this.activeLogs.get(sessionKey);
      if (!logId) return;

      const endTime = Date.now();
      const logRef = doc(db, 'activityLogs', logId);
      
      // Get the start time first
      const logDoc = await getDocs(query(collection(db, 'activityLogs'), where('__name__', '==', logId)));
      if (!logDoc.empty) {
        const logData = logDoc.docs[0].data() as ActivityLog;
        const startTime = logData.startTime;
        const duration = endTime - startTime;

        await updateDoc(logRef, {
          endTime,
          duration,
          updatedAt: serverTimestamp()
        });
      }

      this.activeLogs.delete(sessionKey);
    } catch (error) {
      console.error('Error ending page view log:', error);
    }
  }

  /**
   * Log an API call
   */
  async logApiCall(
    adminId: string,
    adminEmail: string,
    adminName: string,
    route: string,
    method: string,
    statusCode: number,
    metadata?: Record<string, any>,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      const logData: Omit<ActivityLog, 'id'> = {
        adminId,
        adminEmail,
        adminName,
        route,
        action: 'api_call',
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        method,
        statusCode,
        metadata,
        userAgent,
        ipAddress,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'activityLogs'), logData);
    } catch (error) {
      console.error('Error logging API call:', error);
    }
  }

  /**
   * Log login activity
   */
  async logLogin(
    adminId: string,
    adminEmail: string,
    adminName: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      const logData: Omit<ActivityLog, 'id'> = {
        adminId,
        adminEmail,
        adminName,
        route: '/login',
        action: 'login',
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        userAgent,
        ipAddress,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'activityLogs'), logData);
    } catch (error) {
      console.error('Error logging login:', error);
    }
  }

  /**
   * Log logout activity
   */
  async logLogout(
    adminId: string,
    adminEmail: string,
    adminName: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    try {
      const logData: Omit<ActivityLog, 'id'> = {
        adminId,
        adminEmail,
        adminName,
        route: '/logout',
        action: 'logout',
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        userAgent,
        ipAddress,
        createdAt: Date.now()
      };

      await addDoc(collection(db, 'activityLogs'), logData);
    } catch (error) {
      console.error('Error logging logout:', error);
    }
  }

  /**
   * Get activity logs for an admin
   */
  async getAdminLogs(
    adminId: string,
    pageSize: number = 50,
    startAfter?: number
  ): Promise<ActivityLog[]> {
    try {
      let q = query(
        collection(db, 'activityLogs'),
        where('adminId', '==', adminId),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      if (startAfter) {
        q = query(
          collection(db, 'activityLogs'),
          where('adminId', '==', adminId),
          where('createdAt', '<', startAfter),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
    } catch (error) {
      console.error('Error getting admin logs:', error);
      return [];
    }
  }
/**
 * Log a page view (for middleware/server-side)
 */
async logPageView(
  adminId: string,
  adminEmail: string,
  adminName: string,
  route: string,
  userAgent?: string,
  ipAddress?: string,
  referer?: string
): Promise<void> {
  try {
    const logData: Omit<ActivityLog, 'id'> = {
      adminId,
      adminEmail,
      adminName,
      route,
      action: 'page_view',
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0, // Duration will be 0 for middleware-tracked views
      userAgent,
      ipAddress,
      metadata: {
        referer: referer || 'direct',
        trackedFrom: 'middleware'
      },
      createdAt: Date.now()
    };

    await addDoc(collection(db, 'activityLogs'), logData);
  } catch (error) {
    console.error('Error logging page view:', error);
  }
}
  /**
   * Get all activity logs (for admin dashboard)
   */
  async getAllLogs(
    pageSize: number = 100,
    startAfter?: number
  ): Promise<ActivityLog[]> {
    try {
      let q = query(
        collection(db, 'activityLogs'),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      if (startAfter) {
        q = query(
          collection(db, 'activityLogs'),
          where('createdAt', '<', startAfter),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ActivityLog[];
    } catch (error) {
      console.error('Error getting all logs:', error);
      return [];
    }
  }
}

export const activityLogger = ActivityLogger.getInstance();