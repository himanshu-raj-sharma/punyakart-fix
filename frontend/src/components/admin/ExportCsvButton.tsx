import React from 'react';
import { Download } from 'lucide-react';

interface ExportCsvButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export const ExportCsvButton: React.FC<ExportCsvButtonProps> = ({
  onClick,
  disabled,
  label = 'Export CSV',
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-neutral-800 dark:text-white text-xs font-bold cursor-pointer hover:border-[#FF6B00] disabled:opacity-50"
  >
    <Download className="w-3.5 h-3.5" />
    {label}
  </button>
);
