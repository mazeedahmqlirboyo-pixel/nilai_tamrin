import React, { useState } from 'react';
import { ChevronDown, X, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function PremiumSelect({ 
  value, 
  onChange, 
  options, 
  placeholder = "Pilih...",
  icon: Icon,
  disabled = false,
  title = "Pilih Opsi",
  activeColorClass = "text-blue-700",
  activeBgClass = "bg-blue-50 border-blue-200 text-blue-800",
  defaultBgClass = "bg-slate-50 border-slate-200 text-slate-700",
  buttonClassName = "py-4"
}) {
  const [isOpen, setIsOpen] = useState(false);

  const normalizedOptions = options.map(opt => 
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  return (
    <>
      <button
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={cn(
          "w-full relative flex items-center justify-between border rounded-2xl px-4 text-sm font-medium transition-colors outline-none",
          disabled && "opacity-50 cursor-not-allowed",
          value ? activeBgClass : defaultBgClass,
          buttonClassName
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {Icon && <Icon className={cn("w-5 h-5 flex-shrink-0", value ? "text-blue-500" : "text-slate-400")} />}
          <span className="truncate font-semibold">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 flex-shrink-0 transition-transform", isOpen ? "rotate-180" : "", value ? "text-blue-500" : "text-slate-400")} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsOpen(false)}>
          <div 
            className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-safe shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 relative overflow-hidden flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 flex-shrink-0 sm:hidden"></div>
            
            <div className="flex justify-between items-center mb-5 flex-shrink-0">
              <h3 className="font-bold text-xl text-slate-800">{title}</h3>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto space-y-3 pr-2 custom-scrollbar flex-1 pb-4">
              {normalizedOptions.map(opt => {
                const isActive = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 text-left",
                      isActive 
                        ? "border-blue-500 bg-blue-50/50 shadow-[0_4px_12px_rgba(59,130,246,0.15)]" 
                        : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {Icon && (
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shadow-sm",
                          isActive ? "bg-blue-500 text-white" : "bg-white text-slate-400 border border-slate-200"
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>
                      )}
                      <span className={cn(
                        "font-bold text-base",
                        isActive ? activeColorClass : (opt.isDanger ? "text-red-500" : "text-slate-600")
                      )}>
                        {opt.label}
                        {opt.isDanger && !isActive && <span className="text-[10px] font-bold tracking-wide bg-red-100 text-red-600 px-2 py-0.5 rounded-md ml-2 relative -top-0.5 italic">Sudah diisi</span>}
                      </span>
                    </div>
                    {isActive && <CheckCircle2 className="w-6 h-6 text-blue-500 animate-in zoom-in duration-300" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
