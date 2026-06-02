"use client";

import { Printer } from 'lucide-react';

export function PublicReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-green px-6 py-3 font-bold text-white shadow-lg transition-all hover:brightness-110 print:hidden"
    >
      <Printer size={20} />
      Exportar PDF
    </button>
  );
}
