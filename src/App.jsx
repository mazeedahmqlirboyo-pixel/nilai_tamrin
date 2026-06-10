import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Save, List, CheckCircle2, ChevronDown, User, CalendarDays, ClipboardCheck, X, AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase';
import InputTab from './components/InputTab';
import RecapTab from './components/RecapTab';
import logoSrc from './assets/logo.png';
import { SiswiProvider, useSiswi } from './contexts/SiswiContext';
import { TAHUN_AJARANS } from './lib/years';

const PERIODES = ['Qobla Maulud', "Ba'da Maulud"];

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

function AppContent() {
  const [activeTab, setActiveTab] = useState('input');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const {
    globalPeriode: periode,
    updateGlobalPeriode,
    globalTahunAjaran,
    updateGlobalTahunAjaran
  } = useSiswi();

  // Periode Auth Modal States
  const [showPeriodeSelector, setShowPeriodeSelector] = useState(false);
  const [showPeriodeModal, setShowPeriodeModal] = useState(false);
  const [tempPeriode, setTempPeriode] = useState('');
  const [periodePassword, setPeriodePassword] = useState('');
  const [periodeError, setPeriodeError] = useState('');

  // Tahun Ajaran Auth Modal States
  const [showTaSelector, setShowTaSelector] = useState(false);
  const [showTaModal, setShowTaModal] = useState(false);
  const [tempTa, setTempTa] = useState('');
  const [taPassword, setTaPassword] = useState('');
  const [taError, setTaError] = useState('');

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 md:pb-28 font-sans selection:bg-blue-200">
      {/* Ramping Sticky Header */}
      <header className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 rounded-b-2xl shadow-md py-3 px-4 sticky top-0 z-30 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-5 rounded-full blur-xl transform translate-x-6 -translate-y-6"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-white opacity-5 rounded-full blur-lg transform -translate-x-4 translate-y-4"></div>

        <div className="flex justify-between items-center max-w-lg md:max-w-5xl mx-auto relative z-10">
          {/* Logo & Title */}
          <div className="flex items-center gap-2">
            <img
              src={logoSrc}
              alt="Logo MAZEEDA"
              className="w-9 h-9 rounded-lg object-contain shadow bg-white p-0.5 border border-white/60"
            />
            <span className="text-white font-black tracking-wide text-sm">MAZEEDA</span>
          </div>

          {/* Active Settings Pills */}
          <div className="flex items-center gap-1.5">
            {/* TA Pill */}
            <button
              onClick={() => setShowTaSelector(true)}
              className="flex items-center gap-1 bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/15 rounded-full py-1.5 px-3 text-[10px] font-bold text-white transition-all backdrop-blur-sm shadow-sm"
            >
              <span>{globalTahunAjaran || 'TA'}</span>
              <ChevronDown className="w-3 h-3 text-blue-200" />
            </button>

            {/* Periode Pill */}
            <button
              onClick={() => setShowPeriodeSelector(true)}
              className="flex items-center gap-1 bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/15 rounded-full py-1.5 px-3 text-[10px] font-bold text-white transition-all backdrop-blur-sm shadow-sm"
            >
              <span>{periode || 'Periode'}</span>
              <ChevronDown className="w-3 h-3 text-blue-200" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 max-w-lg md:max-w-5xl mx-auto pb-10">
        {activeTab === 'input' ? <InputTab /> : <RecapTab />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 md:bottom-4 left-0 right-0 md:left-1/2 md:-translate-x-1/2 md:w-auto md:min-w-[400px] md:rounded-3xl md:border md:shadow-lg bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] z-40 pb-safe supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-lg mx-auto flex justify-around px-3 py-2">
          <button
            onClick={() => setActiveTab('input')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300",
              activeTab === 'input' ? 'text-blue-600 bg-blue-50 scale-105' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'
            )}
          >
            <ClipboardCheck className={cn(
              "w-6 h-6 mb-1 transition-transform",
              activeTab === 'input' ? 'animate-bounce drop-shadow-md text-blue-600' : ''
            )} />
            <span className="text-[11px] font-bold tracking-wide">Input</span>
          </button>
          <button
            onClick={() => setActiveTab('recap')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300",
              activeTab === 'recap' ? 'text-blue-600 bg-blue-50 scale-105' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'
            )}
          >
            <List className={cn(
              "w-6 h-6 mb-1 transition-transform",
              activeTab === 'recap' ? 'drop-shadow-md text-blue-600' : ''
            )} />
            <span className="text-[11px] font-bold tracking-wide">Rekapan</span>
          </button>
        </div>
      </nav>

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-[80px] left-0 right-0 z-50 px-4 pb-2 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-lg mx-auto">
          <div className="bg-blue-600 text-white rounded-2xl p-4 shadow-lg flex items-center justify-between border border-blue-500">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1.5 rounded-xl">
                <img src={logoSrc} alt="Logo" className="w-7 h-7 object-contain" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Install Aplikasi</h3>
                <p className="text-xs text-blue-100 mt-0.5">Pasang di layar utama</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowInstallBanner(false)}
                className="px-3 py-1.5 text-xs font-medium text-blue-100 hover:bg-white/10 rounded-lg transition-colors"
              >
                Nanti
              </button>
              <button 
                onClick={handleInstallClick}
                className="px-4 py-1.5 text-xs font-bold bg-white text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-sm"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Tahun Ajaran Selector Modal */}
      {showTaSelector && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowTaSelector(false)}>
          <div 
            className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-safe shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 relative overflow-hidden flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden flex-shrink-0"></div>
            
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <h3 className="font-bold text-lg text-slate-800">Pilih Tahun Ajaran</h3>
              <button 
                onClick={() => setShowTaSelector(false)} 
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto space-y-1.5 pr-1 custom-scrollbar flex-1 pb-4">
              {TAHUN_AJARANS.map(ta => {
                const isActive = ta === globalTahunAjaran;
                return (
                  <button
                    key={ta}
                    onClick={() => {
                      if (!isActive) {
                        setTempTa(ta);
                        setShowTaSelector(false);
                        setTimeout(() => setShowTaModal(true), 150);
                      } else {
                        setShowTaSelector(false);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 transition-all duration-200 text-left",
                      isActive 
                        ? "border-blue-500 bg-blue-50/50 shadow-[0_2px_8px_rgba(59,130,246,0.1)]" 
                        : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={isActive ? "w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-blue-500 text-white" : "w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-white text-slate-400 border border-slate-200"}>
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <span className={cn(
                        "font-bold text-sm",
                        isActive ? "text-blue-700" : "text-slate-600"
                      )}>
                        {ta}
                      </span>
                    </div>
                    {isActive && <CheckCircle2 className="w-5 h-5 text-blue-500 animate-in" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tahun Ajaran Password Modal */}
      {showTaModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800">Ganti Tahun Ajaran?</h3>
              <button 
                onClick={() => {
                  setShowTaModal(false);
                  setTaPassword('');
                  setTaError('');
                }} 
                className="text-slate-400 hover:bg-slate-100 p-1 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Anda akan mengganti Tahun Ajaran aktif ke <strong>{tempTa}</strong>. Masukkan password admin untuk melanjutkan.
            </p>
            {taError && (
              <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{taError}</span>
              </div>
            )}
            <input 
              type="password"
              placeholder="Password..."
              value={taPassword}
              onChange={(e) => setTaPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <button 
              onClick={async () => {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                  email: 'admin@mazeeda.com',
                  password: taPassword,
                });

                if (!signInError) {
                  const success = await updateGlobalTahunAjaran(tempTa);
                  if (success) {
                    setShowTaModal(false);
                    setTaPassword('');
                    setTaError('');
                  } else {
                    setTaError('Gagal menyimpan ke database!');
                  }
                  await supabase.auth.signOut();
                } else {
                  if (signInError.message.includes('Invalid login credentials')) {
                    setTaError('Password salah!');
                  } else {
                    setTaError('Akun admin belum disetting di Supabase!');
                  }
                }
              }}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition"
            >
              Konfirmasi Ganti
            </button>
          </div>
        </div>
      )}

      {/* Premium Periode Selector Modal */}
      {showPeriodeSelector && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowPeriodeSelector(false)}>
          <div 
            className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 pb-safe shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 relative overflow-hidden flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden flex-shrink-0"></div>
            
            <div className="flex justify-between items-center mb-3 flex-shrink-0">
              <h3 className="font-bold text-lg text-slate-800">Pilih Periode</h3>
              <button 
                onClick={() => setShowPeriodeSelector(false)} 
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto space-y-1.5 pr-1 custom-scrollbar flex-1 pb-4">
              {PERIODES.map(p => {
                const isActive = p === periode;
                return (
                  <button
                    key={p}
                    onClick={() => {
                      if (!isActive) {
                        setTempPeriode(p);
                        setShowPeriodeSelector(false);
                        setTimeout(() => setShowPeriodeModal(true), 150);
                      } else {
                        setShowPeriodeSelector(false);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 rounded-2xl border-2 transition-all duration-200 text-left",
                      isActive 
                        ? "border-blue-500 bg-blue-50/50 shadow-[0_2px_8px_rgba(59,130,246,0.1)]" 
                        : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={isActive ? "w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-blue-500 text-white" : "w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-white text-slate-400 border border-slate-200"}>
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <span className={cn(
                        "font-bold text-sm",
                        isActive ? "text-blue-700" : "text-slate-600"
                      )}>
                        {p}
                      </span>
                    </div>
                    {isActive && <CheckCircle2 className="w-5 h-5 text-blue-500 animate-in" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Periode Password Modal */}
      {showPeriodeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800">Ganti Periode?</h3>
              <button 
                onClick={() => {
                  setShowPeriodeModal(false);
                  setPeriodePassword('');
                  setPeriodeError('');
                }} 
                className="text-slate-400 hover:bg-slate-100 p-1 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Anda akan mengganti periode ke <strong>{tempPeriode}</strong>. Masukkan password admin untuk melanjutkan.
            </p>
            {periodeError && (
              <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{periodeError}</span>
              </div>
            )}
            <input 
              type="password"
              placeholder="Password..."
              value={periodePassword}
              onChange={(e) => setPeriodePassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-4"
              autoFocus
            />
            <button 
              onClick={async () => {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                  email: 'admin@mazeeda.com',
                  password: periodePassword,
                });

                if (!signInError) {
                  const success = await updateGlobalPeriode(tempPeriode);
                  if (success) {
                    setShowPeriodeModal(false);
                    setPeriodePassword('');
                    setPeriodeError('');
                  } else {
                    setPeriodeError('Gagal menyimpan ke database!');
                  }
                  await supabase.auth.signOut();
                } else {
                  if (signInError.message.includes('Invalid login credentials')) {
                    setPeriodeError('Password salah!');
                  } else {
                    setPeriodeError('Akun admin belum disetting di Supabase!');
                  }
                }
              }}
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition"
            >
              Konfirmasi Ganti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SiswiProvider>
      <AppContent />
    </SiswiProvider>
  );
}
