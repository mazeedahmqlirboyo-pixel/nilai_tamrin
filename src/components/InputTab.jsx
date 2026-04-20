import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Save, CheckCircle2, AlertCircle, Building, ChevronDown, BookOpen } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const PERIODES = ['Qobla Maulud', "Ba'da Maulud"];
const MAPELS = [
  'Sullam Taufiq', 'Tijan Daroini', "Arba'in", 'Fushulul Fikriyah', 
  "Imla'", "Qowa'id Shorfiyah", 'Tasrif Istilahi', 'Akhlaq Lil Banat', 
  'Fathul Mubin', "Al-'Ilal", 'Tuhfatul Atfal'
];

export default function InputTab() {
  const [periode, setPeriode] = useState('Qobla Maulud'); // Default locked to Qobla Maulud
  
  const [mapel, setMapel] = useState('');
  
  // States for name filtering
  const [selectedBagian, setSelectedBagian] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedName, setSelectedName] = useState('');
  
  const [nilai, setNilai] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  
  const [siswiList, setSiswiList] = useState([]);
  const [gradedSiswis, setGradedSiswis] = useState([]); // Daftar siswi yg sudah dinilai untuk mapel aktif

  // Fetch semua siswi sekali saat awal
  React.useEffect(() => {
    async function loadSiswi() {
      const { data, error } = await supabase.from('siswi').select('nama_siswi, bagian').order('nama_siswi');
      if (!error && data) {
        setSiswiList(data);
      }
    }
    loadSiswi();
  }, []);

  // Fetch nama siswi yang sudah ada nilainya berdasarkan mapel & periode
  React.useEffect(() => {
    async function loadGradedSiswis() {
      if (!mapel || !periode) {
        setGradedSiswis([]);
        return;
      }
      const { data, error } = await supabase
        .from('nilai_tamrin')
        .select('nama_siswi')
        .eq('mata_pelajaran', mapel)
        .eq('periode', periode);
        
      if (!error && data) {
        setGradedSiswis(data.map(d => d.nama_siswi));
      }
    }
    loadGradedSiswis();
  }, [mapel, periode]);

  const uniqueBagian = useMemo(() => {
    const bgns = new Set();
    siswiList.forEach(s => {
      if (s.bagian) bgns.add(s.bagian);
    });
    return Array.from(bgns).sort();
  }, [siswiList]);

  // Generated grid array 0, 0.5, 1 ... 10
  const NILAI_GRID = useMemo(() => Array.from({ length: 21 }, (_, i) => i * 0.5), []);

  const filteredNames = useMemo(() => {
    let filtered = siswiList;
    
    // 1. Filter by bagian first
    if (selectedBagian) {
      filtered = filtered.filter(item => item.bagian === selectedBagian);
    }
    
    // 2. Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.nama_siswi.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [searchQuery, selectedBagian, siswiList]);

  const handleSave = async () => {
    if (!periode || !selectedName || !mapel || nilai === null) {
      setNotification({ type: 'error', message: 'Lengkapi semua data sebelum menyimpan!' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setIsSubmitting(true);
    setNotification(null);

    const { error } = await supabase
      .from('nilai_tamrin')
      .upsert({
        nama_siswi: selectedName,
        mata_pelajaran: mapel,
        periode: periode,
        nilai: nilai
      }, {
        onConflict: 'nama_siswi, mata_pelajaran, periode'
      });

    setIsSubmitting(false);

    if (error) {
      console.error(error);
      setNotification({ type: 'error', message: `Gagal menyimpan: ${error.message}` });
    } else {
      setNotification({ type: 'success', message: 'Berhasil! Data nilai tersimpan.' });
      setGradedSiswis(prev => [...prev, selectedName]);
      setNilai(null);
      setSelectedName(''); // Unselect student so user can quickly pick next
    }
    
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  return (
    <div className="space-y-4 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Notification Toast */}
      {notification && (
        <div className={cn(
          "p-4 rounded-2xl flex items-center gap-3 text-sm font-medium transition-all shadow-md",
          notification.type === 'success' ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        )}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          {notification.message}
        </div>
      )}

      {/* Periode Status */}
      <div className="bg-blue-600 rounded-2xl py-3 px-4 shadow-sm border border-blue-500/50 flex justify-between items-center mb-4">
        <span className="text-blue-100 text-sm font-semibold">Periode Aktif:</span>
        <span className="text-white text-sm font-bold bg-blue-700/50 px-3 py-1 rounded-full">{periode}</span>
      </div>

      {/* Mapel Card - MOVED UP */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
        <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
          Pilih Mata Pelajaran
        </label>
        <div className="relative">
          <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <select 
            value={mapel} 
            onChange={(e) => {
              setMapel(e.target.value);
              setSelectedName(''); // reset selected siswi when mapel changes
            }}
            className={cn(
              "w-full border rounded-2xl py-4 pl-12 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none transition-colors",
              mapel ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-slate-50 border-slate-200 text-slate-700"
            )}
          >
            <option value="" disabled>Pilih mapel terlebih dahulu...</option>
            {MAPELS.map(m => (
              <option key={m} value={m} className="text-slate-800">{m}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
        </div>
      </div>

      {/* Siswi Selection Card - MOVED DOWN */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
        <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
          Pilih Bagian & Cari Siswi
        </label>
        
        {selectedName ? (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-2xl">
            <span className="font-medium text-blue-900">{selectedName}</span>
            <button 
              onClick={() => setSelectedName('')} 
              className="text-blue-500 text-sm font-semibold hover:text-blue-700 bg-white px-3 py-1 rounded-full shadow-sm transition-colors"
            >
              Ganti
            </button>
          </div>
        ) : (
          <div className={cn("space-y-3 transition-opacity", !mapel && "opacity-50 pointer-events-none")} >
            
            {/* Bagian Filter */}
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                value={selectedBagian} 
                onChange={(e) => {
                  setSelectedBagian(e.target.value);
                  setSearchQuery(''); // Reset pencarian teks jika ganti bagian
                }}
                className="w-full bg-blue-50 border border-blue-100 rounded-2xl p-3 pl-10 pr-10 text-sm font-medium text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none transition-colors"
                disabled={uniqueBagian.length === 0 || !mapel}
              >
                <option value="">-- Semua Bagian --</option>
                {uniqueBagian.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
            </div>

            {/* Nominal Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text"
                placeholder={selectedBagian ? `Cari nama di bagian ${selectedBagian}...` : "Cari nama..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={!mapel}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
              />
            </div>
            
            {/* List */}
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl p-1 bg-slate-50 border border-slate-100 custom-scrollbar">
              {!mapel ? (
                <div className="p-4 text-center text-sm text-red-500 font-semibold bg-red-50 rounded-lg border border-red-100">
                  Pilih Mata Pelajaran di atas terlebih dahulu!
                </div>
              ) : filteredNames.length > 0 ? filteredNames.map(item => {
                const isComplete = gradedSiswis.includes(item.nama_siswi);
                
                return (
                  <button
                    key={item.nama_siswi}
                    onClick={() => setSelectedName(item.nama_siswi)}
                    disabled={isComplete}
                    className={cn(
                      "w-full text-left px-4 py-3 text-sm rounded-xl transition-colors font-medium flex justify-between items-center",
                      isComplete 
                        ? "bg-red-50 text-red-500 border border-red-100 cursor-not-allowed opacity-80" 
                        : "text-slate-700 hover:bg-white hover:text-blue-600 focus:bg-white"
                    )}
                  >
                    <div className="flex flex-col">
                      <span>{item.nama_siswi}</span>
                      {isComplete && (
                        <span className="text-[10px] text-red-600 font-bold tracking-wide italic mt-0.5">Sudah Dinilai</span>
                      )}
                    </div>
                    {item.bagian && (
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md",
                        isComplete ? "bg-red-100 text-red-600" : "bg-slate-200/70 text-slate-500"
                      )}>
                        {item.bagian}
                      </span>
                    )}
                  </button>
                );
              }) : (
                <div className="p-3 text-center text-sm text-slate-400">Tidak ada siswi ditemukan</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nilai Grid Card */}
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
              disabled={!mapel || !selectedName}
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

      {/* Action Area */}
      <div className="pt-2 pb-6">
        <button
          onClick={handleSave}
          disabled={isSubmitting || !periode || !selectedName || !mapel || nilai === null}
          className="w-full bg-blue-600 text-white font-bold text-lg rounded-3xl py-4 flex items-center justify-center gap-2 shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:shadow-none transition-all active:scale-[0.98]"
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Simpan Data
            </>
          )}
        </button>
      </div>

    </div>
  );
}
