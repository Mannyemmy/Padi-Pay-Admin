'use client';

import { AlertCircle } from 'lucide-react';

interface ErrorProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export default function Error({ title, message, onRetry }: ErrorProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="bg-white rounded-lg border border-red-200 p-8 max-w-md w-full">
        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-red-100 mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-red-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 text-center mb-2">{title}</h1>
        <p className="text-gray-600 text-center mb-6">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}
