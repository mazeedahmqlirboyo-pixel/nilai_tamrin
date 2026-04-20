import React, { useState } from 'react';
import { BookOpen, Search, Save, List, CheckCircle2, ChevronDown, User, CalendarDays, ClipboardCheck } from 'lucide-react';
import { supabase } from './lib/supabase';
import InputTab from './components/InputTab';
import RecapTab from './components/RecapTab';
import logoSrc from './assets/logo.jpg';

function App() {
  const [activeTab, setActiveTab] = useState('input');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-24 font-sans selection:bg-blue-200">
      {/* Header */}
      <header className="bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 text-white rounded-b-[2.5rem] shadow-xl pt-12 pb-8 px-6 sticky top-0 z-30 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full blur-xl transform -translate-x-8 translate-y-8"></div>
        
        <div className="flex items-center gap-4 relative z-10">
          <img 
            src={logoSrc} 
            alt="Logo Mazeeda" 
            className="w-14 h-14 rounded-full object-cover border-[3px] border-white/80 shadow-md bg-white"
          />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight drop-shadow-sm">
              Mazeeda Tamrin
            </h1>
            <p className="text-blue-100 mt-1 text-sm font-medium tracking-wide">Sistem Input Nilai Santriwati</p>
          </div>
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
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 ${
              activeTab === 'input' ? 'text-blue-600 bg-blue-50 scale-105' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'
            }`}
          >
            <ClipboardCheck className={`w-6 h-6 mb-1 transition-transform ${activeTab === 'input' ? 'animate-bounce drop-shadow-md text-blue-600' : ''}`} />
            <span className="text-[11px] font-bold tracking-wide">Input</span>
          </button>
          <button
            onClick={() => setActiveTab('recap')}
            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 ${
              activeTab === 'recap' ? 'text-blue-600 bg-blue-50 scale-105' : 'text-slate-400 hover:text-blue-500 hover:bg-slate-50'
            }`}
          >
            <List className={`w-6 h-6 mb-1 transition-transform ${activeTab === 'recap' ? 'drop-shadow-md text-blue-600' : ''}`} />
            <span className="text-[11px] font-bold tracking-wide">Rekapan</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
