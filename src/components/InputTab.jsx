import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Save, CheckCircle2, AlertCircle, Building, BookOpen } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSiswi } from '../contexts/SiswiContext';
import NilaiGrid from './NilaiGrid';
import PremiumSelect from './PremiumSelect';
import { TAHUN_AJARANS } from '../lib/years';
function cn(...inputs) {
  return twMerge(clsx(inputs));
}



export default function InputTab() {
  const [mapel, setMapel] = useState('');
  
  // States for name filtering
  const [selectedBagian, setSelectedBagian] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNis, setSelectedNis] = useState('');
  
  const [nilai, setNilai] = useState(null);
  const [isAbsent, setIsAbsent] = useState(false);
  const [catatan, setCatatan] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const { 
    siswiList, 
    uniqueBagian, 
    globalPeriode: periode, 
    updateGlobalPeriode,
    globalTahunAjaran,
    updateGlobalTahunAjaran,
    mapels
  } = useSiswi();
  const [gradedSiswis, setGradedSiswis] = useState([]); // Daftar siswi yg sudah dinilai untuk mapel aktif
  const [gradedMapelsForSiswi, setGradedMapelsForSiswi] = useState([]); // Daftar mapel yg sudah dinilai untuk siswi aktif

  const selectedSiswi = useMemo(() => {
    return (siswiList || []).find(s => s.nis === selectedNis);
  }, [selectedNis, siswiList]);



  // Fetch NIS siswi yang sudah ada nilainya berdasarkan mapel, periode & tahun_ajaran
  React.useEffect(() => {
    async function loadGradedSiswis() {
      if (!mapel || !periode || !globalTahunAjaran) {
        setGradedSiswis([]);
        return;
      }
      const { data, error } = await supabase
        .from('nilai_tamrin')
        .select('nis')
        .eq('mata_pelajaran', mapel)
        .eq('periode', periode)
        .eq('tahun_ajaran', globalTahunAjaran)
        .eq('kategori', 'Tamrin');
        
      if (!error && data) {
        setGradedSiswis(data.map(d => d.nis));
      }
    }
    loadGradedSiswis();
  }, [mapel, periode, globalTahunAjaran]);

  // Fetch mapel yang sudah ada nilainya berdasarkan siswi (NIS), periode & tahun_ajaran
  React.useEffect(() => {
    async function loadGradedMapels() {
      if (!selectedNis || !periode || !globalTahunAjaran) {
        setGradedMapelsForSiswi([]);
        return;
      }
      const { data, error } = await supabase
        .from('nilai_tamrin')
        .select('mata_pelajaran')
        .eq('nis', selectedNis)
        .eq('periode', periode)
        .eq('tahun_ajaran', globalTahunAjaran)
        .eq('kategori', 'Tamrin');
        
      if (!error && data) {
        setGradedMapelsForSiswi(data.map(d => d.mata_pelajaran));
      }
    }
    loadGradedMapels();
  }, [selectedNis, periode, globalTahunAjaran]);


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

  const handleSave = () => {
    const isNilaiValid = isAbsent ? true : (nilai !== null);
    const isCatatanValid = isAbsent ? (catatan && catatan.trim() !== '') : true;

    if (!periode || !selectedNis || !mapel || !isNilaiValid || !isCatatanValid) {
      setNotification({ type: 'error', message: 'Lengkapi semua data sebelum menyimpan!' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (gradedSiswis.includes(selectedNis)) {
      setShowConfirmModal(true);
    } else {
      executeSave();
    }
  };

  const executeSave = async () => {
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setNotification(null);

    const { error } = await supabase
      .from('nilai_tamrin')
      .upsert({
        nis: selectedNis,
        nama_siswi: selectedSiswi?.nama_siswi,
        mata_pelajaran: mapel,
        periode: periode,
        tahun_ajaran: globalTahunAjaran,
        kategori: 'Tamrin',
        nilai: isAbsent ? -1 : nilai,
        catatan: isAbsent ? catatan.trim() : null
      }, {
        onConflict: 'nis, mata_pelajaran, periode, tahun_ajaran, kategori'
      });

    setIsSubmitting(false);

    if (error) {
      console.error(error);
      setNotification({ type: 'error', message: `Gagal menyimpan: ${error.message}` });
      setTimeout(() => setNotification(null), 4000);
    } else {
      setGradedSiswis(prev => Array.from(new Set([...prev, selectedNis])));
      setGradedMapelsForSiswi(prev => Array.from(new Set([...prev, mapel])));
      setNilai(null);
      setIsAbsent(false);
      setCatatan('');
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 500);
    }
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



      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Left Column - Inputs (Steps 1 & 2 + Absent Option) */}
        <div className="md:col-span-5 space-y-4">
          {/* Siswi Selection Card - NOW STEP 1 */}
          <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
            <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
              Pilih Bagian & Cari Siswi
            </label>
            
            {selectedNis ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-3 rounded-2xl">
                <div className="flex flex-col">
                  <span className="font-medium text-blue-900">{selectedSiswi?.nama_siswi}</span>
                  <span className="text-[10px] text-blue-500 font-semibold mt-0.5">NIS: {selectedNis}</span>
                  {gradedSiswis.includes(selectedNis) && (
                    <span className="text-[10px] text-blue-600 font-semibold italic mt-0.5">Nilai sudah ada (Simpan untuk update)</span>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedNis('')} 
                  className="text-blue-500 text-sm font-semibold hover:text-blue-700 bg-white px-3 py-1 rounded-full shadow-sm transition-colors"
                >
                  Ganti
                </button>
              </div>
            ) : (
              <div className="space-y-3" >
                
                {/* Bagian Filter */}
                <PremiumSelect
                  value={selectedBagian}
                  onChange={(val) => {
                    setSelectedBagian(val);
                    setSearchQuery('');
                  }}
                  options={[{ label: "-- Semua Bagian --", value: "" }, ...uniqueBagian]}
                  placeholder="-- Semua Bagian --"
                  title="Pilih Bagian"
                  icon={Building}
                  disabled={uniqueBagian.length === 0}
                  buttonClassName="py-3"
                />

                {/* Nominal Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder={selectedBagian ? `Cari nama di bagian ${selectedBagian}...` : "Cari nama..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                  />
                </div>
                
                {/* List */}
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl p-1 bg-slate-50 border border-slate-100 custom-scrollbar">
                  {filteredNames.length > 0 ? filteredNames.map(item => {
                    const isComplete = gradedSiswis.includes(item.nis);
                    
                    return (
                      <button
                        key={item.nis}
                        onClick={() => setSelectedNis(item.nis)}
                        className={cn(
                          "w-full text-left px-4 py-3 text-sm rounded-xl transition-colors font-medium flex justify-between items-center",
                          isComplete 
                            ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 focus:bg-green-100" 
                            : "text-slate-700 hover:bg-white hover:text-blue-600 focus:bg-white"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="font-bold">{item.nama_siswi}</span>
                          <span className="text-[10px] text-slate-400">NIS: {item.nis}</span>
                          {isComplete && (
                            <span className="text-[10px] text-green-600 font-bold tracking-wide italic mt-0.5">Sudah dinilai (Tap untuk update)</span>
                          )}
                        </div>
                        {item.bagian && (
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-md",
                            isComplete ? "bg-green-200 text-green-800" : "bg-slate-200/70 text-slate-500"
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

          {/* Mapel Card - NOW STEP 2 */}
          <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
            <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
              Pilih Mata Pelajaran
            </label>
            <div className={cn("transition-opacity", !selectedNis && "opacity-50 pointer-events-none")}>
              <PremiumSelect
                value={mapel}
                onChange={setMapel}
                options={mapels.map(m => ({
                  label: m,
                  value: m,
                  isDanger: gradedMapelsForSiswi.includes(m)
                }))}
                placeholder={selectedNis ? "Pilih mapel..." : "Pilih siswi terlebih dahulu..."}
                title="Pilih Mata Pelajaran"
                icon={BookOpen}
                disabled={!selectedNis}
              />
            </div>
          </div>

          {/* Absent Option Checkbox */}
          <div className={cn("bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50 transition-opacity", (!mapel || !selectedNis) && "opacity-50 pointer-events-none")}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input 
                type="checkbox"
                checked={isAbsent}
                onChange={(e) => {
                  setIsAbsent(e.target.checked);
                  if (e.target.checked) {
                    setNilai(null); // Reset nilai if marked absent
                  } else {
                    setCatatan(''); // Reset catatan if marked present
                  }
                }}
                disabled={!mapel || !selectedNis}
                className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500/50 cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700">Siswi tidak masuk / Berikan catatan khusus</span>
                <span className="text-xs text-slate-500">Gunakan ini jika siswi berhalangan hadir atau memerlukan keterangan khusus.</span>
              </div>
            </label>

            {isAbsent && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Keterangan / Catatan Masuk (misal: Sakit, Izin, Susulan, dll.)</label>
                <input 
                  type="text"
                  placeholder="Masukkan alasan tidak masuk atau catatan lainnya..."
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Nilai (Step 3 + Action) */}
        <div className="md:col-span-7 space-y-4">
          <NilaiGrid nilai={nilai} setNilai={setNilai} disabled={!mapel || !selectedNis || isAbsent} />

          {/* Action Area */}
          <div className="pt-2 pb-6">
            <button
              onClick={handleSave}
              disabled={
                isSubmitting || 
                !periode || 
                !selectedNis || 
                !mapel || 
                (isAbsent ? (!catatan || catatan.trim() === '') : (nilai === null))
              }
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
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center border border-slate-100">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Update Nilai?</h3>
            <p className="text-sm text-slate-600 mb-6">
              Siswi <strong>{selectedSiswi?.nama_siswi} ({selectedNis})</strong> sudah memiliki nilai untuk mapel <strong>{mapel}</strong>. Yakin ingin memperbarui nilainya?
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-2xl transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={executeSave}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-3 rounded-2xl transition-colors shadow-lg shadow-amber-500/30"
              >
                Yakin, Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col items-center text-center border border-slate-100">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Berhasil!</h3>
            <p className="text-sm text-slate-600 mb-2">Data nilai berhasil disimpan.</p>
          </div>
        </div>
      )}

    </div>
  );
}
