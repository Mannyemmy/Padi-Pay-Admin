'use client';

import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

let toastCounter = 0;
const toastListeners: Set<(toast: Toast) => void> = new Set();
const activeToasts: Map<string, Toast> = new Map();

export const showToast = (
  type: ToastType,
  title: string,
  message?: string,
  duration: number = 4000
) => {
  const id = `toast-${++toastCounter}`;
  const toast: Toast = { id, type, title, message, duration };
  
  activeToasts.set(id, toast);
  toastListeners.forEach((listener) => listener(toast));

  if (duration > 0) {
    setTimeout(() => {
      activeToasts.delete(id);
      toastListeners.forEach((listener) => listener({ ...toast, id: `remove-${id}` }));
    }, duration);
  }

  return id;
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleNewToast = (toast: Toast) => {
      if (toast.id.startsWith('remove-')) {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id.replace('remove-', '')));
      } else {
        setToasts((prev) => [...prev, toast]);
      }
    };

    toastListeners.add(handleNewToast);
    return () => toastListeners.delete(handleNewToast);
  }, []);

  const removeToast = (id: string) => {
    activeToasts.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100',
    error: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-100',
    info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100',
  };

  const iconColors = {
    success: 'text-green-500 dark:text-green-400',
    error: 'text-red-500 dark:text-red-400',
    warning: 'text-yellow-500 dark:text-yellow-400',
    info: 'text-blue-500 dark:text-blue-400',
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`border rounded-lg p-4 flex gap-3 items-start animate-in slide-in-from-top-2 fade-in duration-300 pointer-events-auto ${colors[toast.type]}`}
        >
          <div className={iconColors[toast.type]} style={{ minWidth: '20px' }}>
            {icons[toast.type]}
          </div>
          <div className="flex-1">
            <p className="font-semibold">{toast.title}</p>
            {toast.message && <p className="text-sm opacity-90">{toast.message}</p>}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:opacity-70 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
