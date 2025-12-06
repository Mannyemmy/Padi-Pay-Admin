'use client';

import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { ReactNode } from 'react';

type ConfirmType = 'confirm' | 'warning' | 'danger' | 'success';

interface ConfirmModalProps {
  isOpen: boolean;
  type: ConfirmType;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  type,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const icons: Record<ConfirmType, ReactNode> = {
    confirm: <AlertCircle className="w-12 h-12 text-blue-600" />,
    warning: <AlertCircle className="w-12 h-12 text-yellow-600" />,
    danger: <XCircle className="w-12 h-12 text-red-600" />,
    success: <CheckCircle className="w-12 h-12 text-green-600" />,
  };

  const confirmButtonColors: Record<ConfirmType, string> = {
    confirm: 'bg-blue-600 hover:bg-blue-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    danger: 'bg-red-600 hover:bg-red-700',
    success: 'bg-green-600 hover:bg-green-700',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
        onClick={onCancel}
      ></div>

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full border border-gray-200 dark:border-gray-700">
          {/* Icon */}
          <div className="flex justify-center pt-6">
            {icons[type]}
          </div>

          {/* Content */}
          <div className="p-6 text-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {title}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${confirmButtonColors[type]}`}
              >
                {isLoading ? 'Processing...' : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
