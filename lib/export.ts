export function toCSV(rows: Array<Record<string, any>>): string {
  if (!rows || rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const header = keys.join(',');
  const lines = rows.map((r) => keys.map((k) => escape(r[k])).join(','));
  return [header, ...lines].join('\n');
}

export function downloadFile(content: string, filename: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportToCSV(rows: Array<Record<string, any>>, filename = 'export.csv') {
  const csv = toCSV(rows);
  downloadFile(csv, filename, 'text/csv');
}

export function exportToJSON(rows: Array<Record<string, any>>, filename = 'export.json') {
  const content = JSON.stringify(rows, null, 2);
  downloadFile(content, filename, 'application/json');
}

export function printHTML(title: string, html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title><meta charset="utf-8"/><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial;}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
