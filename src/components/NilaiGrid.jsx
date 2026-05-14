import React, { useMemo } from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function NilaiGrid({ nilai, setNilai, disabled }) {
  // Generated grid array 0, 0.5, 1 ... 10
  const NILAI_GRID = useMemo(() => Array.from({ length: 21 }, (_, i) => i * 0.5), []);

  return (
    <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
      <label className="block text-sm font-semibold text-slate-700 mb-3 text-center flex items-center justify-center gap-2">
        <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
        Tap Nilai
      </label>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {NILAI_GRID.map(val => (
          <button
            key={val}
            onClick={() => setNilai(val)}
            disabled={disabled}
            className={cn(
              "py-3 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100",
              nilai === val
                ? "bg-blue-600 text-white shadow-[0_4px_12px_rgba(37,99,235,0.4)] scale-105 z-10"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            )}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  );
}
