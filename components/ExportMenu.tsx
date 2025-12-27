"use client";

import React from 'react';
import { exportToCSV, exportToJSON, printHTML } from '@/lib/export';

interface ExportMenuProps<T> {
  data: T[] | unknown[];
  filenameBase?: string;
  title?: string;
  renderPrint?: (data: T[] | unknown[]) => string; // returns HTML string
}

export function ExportMenu<T>({ data, filenameBase = 'export', title = 'Export', renderPrint }: ExportMenuProps<T>) {
  const csv = () => exportToCSV((data as unknown[]) as Record<string, unknown>[], `${filenameBase}.csv`);
  const json = () => exportToJSON((data as unknown[]) as Record<string, unknown>[], `${filenameBase}.json`);
  const pdf = () => {
    // Print to PDF via browser print dialog
    const html = renderPrint ? renderPrint(data) : `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    printHTML(title, html);
  };

  return (
    <div className="flex items-center gap-2">
      <button onClick={csv} className="py-2 px-3 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Export CSV</button>
      <button onClick={json} className="py-2 px-3 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Export JSON</button>
      <button onClick={pdf} className="py-2 px-3 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Print / PDF</button>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]+/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
