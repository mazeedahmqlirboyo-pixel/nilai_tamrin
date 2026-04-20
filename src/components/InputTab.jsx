import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Save, CheckCircle2, AlertCircle, Building, ChevronDown } from 'lucide-react';
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
  const [periode, setPeriode] = useState('');
  
  // States for name filtering
  const [selectedBagian, setSelectedBagian] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedName, setSelectedName] = useState('');
  
  const [mapel, setMapel] = useState('');
  const [nilai, setNilai] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  
  const [siswiList, setSiswiList] = useState([]);

  // Fetch siswi dari tabel 'siswi'
  React.useEffect(() => {
    async function loadSiswi() {
      const { data, error } = await supabase.from('siswi').select('nama_siswi, bagian').order('nama_siswi');
      if (!error && data) {
        setSiswiList(data);
      }
    }
    loadSiswi();
  }, []);

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
        onConflict: 'nama_siswi, mata_pelajaran, periode' // important to match unique constraint
      });

    setIsSubmitting(false);

    if (error) {
      console.error(error);
      setNotification({ type: 'error', message: `Gagal menyimpan: ${error.message}` });
    } else {
      setNotification({ type: 'success', message: 'Berhasil! Data nilai tersimpan.' });
      setNilai(null);
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

      {/* Periode Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
        <label className="block text-sm font-semibold text-slate-700 mb-3">Pilih Periode</label>
        <div className="grid grid-cols-2 gap-3">
          {PERIODES.map(p => (
            <button
              key={p}
              onClick={() => setPeriode(p)}
              className={cn(
                "py-3 px-2 rounded-2xl text-sm font-medium transition-all border-2",
                periode === p 
                  ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" 
                  : "bg-white border-slate-100 text-slate-500 w-full hover:border-blue-200"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Siswi Selection Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
        <label className="block text-sm font-semibold text-slate-700 mb-3">Cari & Pilih Nama Siswi</label>
        
        {selectedName ? (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-2xl">
            <span className="font-medium text-blue-900">{selectedName}</span>
            <button 
              onClick={() => {
                setSelectedName('');
                setSearchQuery('');
              }} 
              className="text-blue-500 text-sm font-semibold hover:text-blue-700 bg-white px-3 py-1 rounded-full shadow-sm"
            >
              Ganti
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            
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
                disabled={uniqueBagian.length === 0}
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
                placeholder={selectedBagian ? `Cari nama di bagian ${selectedBagian}...` : "Cari nama siswi di semua bagian..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
              />
            </div>
            
            {/* List */}
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl p-1 bg-slate-50 border border-slate-100 custom-scrollbar">
              {filteredNames.length > 0 ? filteredNames.map(item => (
                <button
                  key={item.nama_siswi}
                  onClick={() => setSelectedName(item.nama_siswi)}
                  className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-white hover:text-blue-600 rounded-xl transition-colors font-medium focus:bg-white flex justify-between items-center"
                >
                  <span>{item.nama_siswi}</span>
                  {item.bagian && <span className="text-xs text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">{item.bagian}</span>}
                </button>
              )) : (
                <div className="p-3 text-center text-sm text-slate-400">Tidak ada siswi ditemukan</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mapel Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
        <label className="block text-sm font-semibold text-slate-700 mb-3">Mata Pelajaran</label>
        <select 
          value={mapel} 
          onChange={(e) => setMapel(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
        >
          <option value="" disabled>Pilih mapel...</option>
          {MAPELS.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Nilai Grid Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
        <label className="block text-sm font-semibold text-slate-700 mb-3 text-center">Tap Nilai</label>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {NILAI_GRID.map(val => (
            <button
              key={val}
              onClick={() => setNilai(val)}
              className={cn(
                "py-3 rounded-2xl text-sm font-semibold transition-all duration-200 active:scale-95",
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
