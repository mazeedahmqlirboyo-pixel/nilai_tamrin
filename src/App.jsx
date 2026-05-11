import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Save, List, CheckCircle2, ChevronDown, User, CalendarDays, ClipboardCheck, Download } from 'lucide-react';
import { supabase } from './lib/supabase';
import InputTab from './components/InputTab';
import RecapTab from './components/RecapTab';
import logoSrc from './assets/logo.png';

function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans selection:bg-blue-200">
      {/* Header */}
      <header className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 rounded-b-3xl shadow-md pt-5 pb-4 px-4 sticky top-0 z-30 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transform translate-x-8 -translate-y-8"></div>
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white opacity-10 rounded-full blur-xl transform -translate-x-6 translate-y-6"></div>

        <div className="flex justify-center items-center relative z-10">
          <img
            src={logoSrc}
            alt="Logo Mazeeda"
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-contain shadow bg-white p-0.5 border border-white/80"
          />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 max-w-lg mx-auto pb-10">
        {activeTab === 'input' ? <InputTab /> : <RecapTab />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] z-40 pb-safe supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-lg mx-auto flex justify-around px-3 py-2">
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 ${activeTab === 'input' ? 'text-blue-600 bg-blue-50 scale-105' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'
              }`}
          >
            <ClipboardCheck className={`w-6 h-6 mb-1 transition-transform ${activeTab === 'input' ? 'animate-bounce drop-shadow-md text-blue-600' : ''}`} />
            <span className="text-[11px] font-bold tracking-wide">Input</span>
          </button>
          <button
            onClick={() => setActiveTab('recap')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 ${activeTab === 'recap' ? 'text-blue-600 bg-blue-50 scale-105' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'
              }`}
          >
            <List className={`w-6 h-6 mb-1 transition-transform ${activeTab === 'recap' ? 'drop-shadow-md text-blue-600' : ''}`} />
            <span className="text-[11px] font-bold tracking-wide">Rekapan</span>
          </button>
        </div>
      </nav>

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="fixed bottom-[80px] left-0 right-0 z-50 px-4 pb-2 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-lg mx-auto">
          <div className="bg-blue-600 text-white rounded-2xl p-4 shadow-lg flex items-center justify-between border border-blue-500">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Download className="w-6 h-6 text-white" />
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
    </div>
  );
}

export default App;
