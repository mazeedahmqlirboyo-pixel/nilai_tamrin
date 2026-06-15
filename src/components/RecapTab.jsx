import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarDays, Book, Loader2, AlertCircle, ChevronDown, GraduationCap, Edit2, Check, X, Building, Download, Upload, Users, CheckCircle, Clock, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSiswi } from '../contexts/SiswiContext';
import AdminModal from './AdminModal';
import PremiumSelect from './PremiumSelect';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function RecapTab() {
  const { siswiBagianMap, uniqueBagian, loadingSiswi, globalPeriode, globalTahunAjaran, siswiList, mapels } = useSiswi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // States for filtering
  const [selectedBagian, setSelectedBagian] = useState('');

  // State for which student accordion is currently open
  const [expandedNis, setExpandedNis] = useState(null);
  
  const [editingRow, setEditingRow] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Admin Modal States
  const [showAdminModal, setShowAdminModal] = useState(false);

  // Detail Modal States for monitoring widget
  const [detailModal, setDetailModal] = useState({ isOpen: false, type: '', data: [] });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setEditingRow(null); // reset editing on fetch
    
    // Fetch ALL records using pagination to avoid Supabase's 1000-row default limit
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData, error: pageError } = await supabase
        .from('nilai_tamrin')
        .select('*')
        .eq('periode', globalPeriode)
        .eq('tahun_ajaran', globalTahunAjaran)
        .eq('kategori', 'Tamrin')
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (pageError) {
        setError(pageError.message);
        hasMore = false;
        break;
      }

      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData);
        from += PAGE_SIZE;
        // If we got fewer rows than PAGE_SIZE, we've reached the end
        if (pageData.length < PAGE_SIZE) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    if (!error) {
      setData(allData);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (globalPeriode && globalTahunAjaran) {
      fetchData();
    }
  }, [globalPeriode, globalTahunAjaran]);

  const uniqueMapels = useMemo(() => {
    const mpls = new Set();
    data.forEach(d => {
      if(d.mata_pelajaran) mpls.add(d.mata_pelajaran);
    });
    return Array.from(mpls).sort();
  }, [data]);

  // Process and group the raw DB records per student, filtering by selected bagian
  const groupedData = useMemo(() => {
    if (!selectedBagian) return []; // If no bagian selected, don't show anyone

    const groups = {};
    data.forEach(item => {
      const bgn = siswiBagianMap[item.nis];
      if (bgn === selectedBagian) {
        if (!groups[item.nis]) {
          groups[item.nis] = { nama_siswi: item.nama_siswi, details: [], total: 0, validCount: 0 };
        }
        groups[item.nis].details.push(item);
        if (item.nilai >= 0) {
          groups[item.nis].total += Number(item.nilai);
          groups[item.nis].validCount += 1;
        }
      }
    });

    // Convert object to array, calculate average, and sort alphabetically
    return Object.entries(groups).map(([nis, val]) => ({
      nis,
      name: val.nama_siswi,
      avg: val.validCount > 0 ? (val.total / val.validCount).toFixed(1) : '-',
      details: val.details, // array of records
      count: val.details.length
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data, siswiBagianMap, selectedBagian]);

  const stats = useMemo(() => {
    if (!selectedBagian) return null;
    
    const studentsInSection = siswiList.filter(s => s.bagian === selectedBagian);
    const totalMapel = mapels.length;
    
    const lengkap = [];
    const belumLengkap = [];
    const belumDiinput = [];
    
    studentsInSection.forEach(student => {
      const record = groupedData.find(g => g.nis === student.nis);
      
      if (!record || record.count === 0) {
        belumDiinput.push(student);
      } else if (record.count < totalMapel) {
        belumLengkap.push({ ...student, count: record.count, totalMapel });
      } else {
        lengkap.push(student);
      }
    });
    
    return { total: studentsInSection.length, lengkap, belumLengkap, belumDiinput };
  }, [selectedBagian, siswiList, groupedData, mapels]);

  const overallStats = useMemo(() => {
    const totalMapel = mapels.length;
    const lengkap = [];
    const belumLengkap = [];
    const belumDiinput = [];

    // Helper for grouped data regardless of filter
    const allGroups = {};
    data.forEach(item => {
      if (!allGroups[item.nis]) {
        allGroups[item.nis] = { count: 0 };
      }
      allGroups[item.nis].count += 1;
    });

    siswiList.forEach(student => {
      const record = allGroups[student.nis];
      if (!record || record.count === 0) {
        belumDiinput.push(student);
      } else if (record.count < totalMapel) {
        belumLengkap.push({ ...student, count: record.count, totalMapel });
      } else {
        lengkap.push(student);
      }
    });

    return { total: siswiList.length, lengkap, belumLengkap, belumDiinput };
  }, [siswiList, data, mapels]);

  const toggleExpand = (nis) => {
    setExpandedNis(prev => prev === nis ? null : nis);
    setEditingRow(null); // Cancel any active edits when swapping accordion
  };

  const startEdit = (detail) => {
    setEditingRow({ id: detail.id, value: detail.nilai < 0 ? '' : detail.nilai });
  };

  const handleUpdate = async (id) => {
    if (!editingRow || editingRow.value === '') return;
    
    setIsUpdating(true);
    const normalizedVal = String(editingRow.value).replace(',', '.');
    const { error: updErr } = await supabase
      .from('nilai_tamrin')
      .update({ 
        nilai: parseFloat(normalizedVal),
        catatan: null // Clear note when new numeric score is entered
      })
      .eq('id', id);

    setIsUpdating(false);

    if (updErr) {
      console.error(updErr);
      window.Swal.fire('Gagal!', 'Gagal update nilai: ' + updErr.message, 'error');
    } else {
      // Modify local data immediately so we don't have to refetch all
      setData(prev => prev.map(item => item.id === id ? { ...item, nilai: parseFloat(normalizedVal), catatan: null } : item));
      setEditingRow(null);
    }
  };

  const exportToExcel = () => {
    // Gunakan daftar mapel dari context (sudah terurut sesuai created_at)
    const mapelList = mapels.length > 0 ? mapels : [];

    // Buat header: Nama Siswi | NIS | Bagian | [mapel dinamis] | Rata-Rata | Periode | Tahun Ajaran
    const headers = [
      'Nama Siswi',
      'NIS',
      'Bagian',
      ...mapelList,
      'Rata-Rata',
      'Periode',
      'Tahun Ajaran'
    ];

    // Buat object lookup: { nis -> { mata_pelajaran -> nilai } }
    const nilaiByNis = {};
    const periodeByNis = {};
    const totalByNis = {}; // { nis -> { total, count } }
    data.forEach(item => {
      if (!nilaiByNis[item.nis]) {
        nilaiByNis[item.nis] = {};
        periodeByNis[item.nis] = item.periode;
        totalByNis[item.nis] = { total: 0, count: 0 };
      }
      nilaiByNis[item.nis][item.mata_pelajaran] = item.nilai < 0 ? (item.catatan || 'Tidak Hadir') : item.nilai;
      if (item.nilai >= 0) {
        totalByNis[item.nis].total += Number(item.nilai);
        totalByNis[item.nis].count += 1;
      }
    });

    // Kumpulkan semua NIS unik, lalu buat baris data
    const allNis = Object.keys(nilaiByNis);
    const rows = allNis.map(nis => {
      const siswa = siswiList.find(s => s.nis === nis);
      const rataRata = totalByNis[nis]?.count > 0
        ? parseFloat((totalByNis[nis].total / totalByNis[nis].count).toFixed(1))
        : '';
      const row = [
        siswa?.nama_siswi || data.find(d => d.nis === nis)?.nama_siswi || '',
        nis,
        siswiBagianMap[nis] || '-',
        ...mapelList.map(mapel => nilaiByNis[nis]?.[mapel] ?? ''),
        rataRata,
        periodeByNis[nis] || globalPeriode,
        globalTahunAjaran
      ];
      return row;
    });

    // Urutkan berdasarkan Bagian lalu Nama Siswi
    rows.sort((a, b) => {
      if (a[2] === b[2]) return a[0].localeCompare(b[0]);
      return a[2].localeCompare(b[2]);
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai Tamrin');
    XLSX.writeFile(wb, 'Rekap_Nilai_Tamrin.xlsx');
  };


  return (
    <div className="space-y-4 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Filter Card */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Rekap Nilai Siswi</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={exportToExcel} 
              className="text-sm font-semibold text-green-700 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full hover:bg-green-100 transition-colors flex items-center gap-1.5"
              title="Unduh semua riwayat nilai ke Excel"
              disabled={data.length === 0}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button 
              onClick={() => setShowAdminModal(true)} 
              className="text-sm font-semibold text-blue-600 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1.5"
              title="Upload master data CSV baru"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload CSV</span>
            </button>
          </div>
        </div>

        <label className="text-sm font-semibold text-slate-600 mt-2 flex items-center gap-1.5 mb-2">
          <Building className="w-4 h-4 text-blue-400" />
          Filter Bagian/Kelas
        </label>
        
        {loadingSiswi && uniqueBagian.length === 0 ? (
          <div className="h-12 bg-slate-100 animate-pulse rounded-2xl w-full"></div>
        ) : (
          <PremiumSelect
            value={selectedBagian}
            onChange={setSelectedBagian}
            options={uniqueBagian}
            placeholder="-- Pilih Bagian --"
            title="Pilih Bagian"
            icon={Building}
            buttonClassName="py-3 bg-slate-50 border-slate-200 text-slate-700"
          />
        )}
      </div>

       {/* Stats Monitoring Widget (per selected bagian) */}
{selectedBagian && stats && (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 
           <div className="bg-white rounded-3xl p-4 border border-blue-50 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center mb-2">
               <Users className="w-4 h-4 text-blue-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{stats.total}</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Siswi</span>
           </div>
           <div className="bg-white rounded-3xl p-4 border border-green-50 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center mb-2">
               <CheckCircle className="w-4 h-4 text-green-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{stats.lengkap.length}</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sudah Lengkap</span>
           </div>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'belumLengkap', data: stats.belumLengkap })}
             className="bg-white rounded-3xl p-4 border border-amber-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-amber-50/30 hover:border-amber-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-amber-50 group-hover:bg-amber-100 transition-colors flex items-center justify-center mb-2">
               <Clock className="w-4 h-4 text-amber-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{stats.belumLengkap.length}</span>
             <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider group-hover:text-amber-600 transition-colors">Belum Lengkap</span>
           </button>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'belumDiinput', data: stats.belumDiinput })}
             className="bg-white rounded-3xl p-4 border border-rose-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-rose-50/30 hover:border-rose-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-rose-50 group-hover:bg-rose-100 transition-colors flex items-center justify-center mb-2">
               <XCircle className="w-4 h-4 text-rose-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{stats.belumDiinput.length}</span>
             <span className="text-[10px] font-bold text-rose-600/70 uppercase tracking-wider group-hover:text-rose-600 transition-colors">Belum Diinput</span>
           </button>
         </div>
       )}

       {/* Overall Stats (when no bagian selected) */}
       {!selectedBagian && overallStats && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
           <div className="bg-white rounded-3xl p-4 border border-blue-50 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center mb-2">
               <Users className="w-4 h-4 text-blue-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{overallStats.total}</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Siswi</span>
           </div>
           <div className="bg-white rounded-3xl p-4 border border-green-50 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center mb-2">
               <CheckCircle className="w-4 h-4 text-green-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{overallStats.lengkap.length}</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sudah Lengkap</span>
           </div>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'belumLengkap', data: overallStats.belumLengkap })}
             className="bg-white rounded-3xl p-4 border border-amber-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-amber-50/30 hover:border-amber-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-amber-50 group-hover:bg-amber-100 transition-colors flex items-center justify-center mb-2">
               <Clock className="w-4 h-4 text-amber-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{overallStats.belumLengkap.length}</span>
             <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider group-hover:text-amber-600 transition-colors">Belum Lengkap</span>
           </button>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'belumDiinput', data: overallStats.belumDiinput })}
             className="bg-white rounded-3xl p-4 border border-rose-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-rose-50/30 hover:border-rose-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-rose-50 group-hover:bg-rose-100 transition-colors flex items-center justify-center mb-2">
               <XCircle className="w-4 h-4 text-rose-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{overallStats.belumDiinput.length}</span>
             <span className="text-[10px] font-bold text-rose-600/70 uppercase tracking-wider group-hover:text-rose-600 transition-colors">Belum Diinput</span>
           </button>
         </div>
       )}

      {/* States Handling */}
      {loading && data.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
          <p className="text-sm">Memuat data rekapan...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 rounded-3xl p-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : !selectedBagian ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm opacity-80">
          <div className="w-16 h-16 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Book className="w-8 h-8" />
          </div>
          <h3 className="text-slate-700 font-semibold mb-1">Pilih Bagian</h3>
          <p className="text-sm text-slate-500 px-4">Silakan pilih bagian di atas terlebih dahulu untuk memunculkan daftar nilai siswi.</p>
        </div>
      ) : groupedData.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Book className="w-8 h-8" />
          </div>
          <h3 className="text-slate-700 font-semibold mb-1">Belum Ada Data</h3>
          <p className="text-sm text-slate-500">Tidak ada riwayat nilai untuk siswi di Bagian '{selectedBagian}'.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedData.map((student) => {
            const isExpanded = expandedNis === student.nis;
            
            return (
              <div 
                key={student.nis} 
                className={cn(
                  "bg-white rounded-3xl shadow-[0_2px_8px_-3px_rgba(6,81,237,0.08)] border transition-all duration-300 overflow-hidden",
                  isExpanded ? "border-blue-200" : "border-blue-50"
                )}
              >
                {/* Header (Always Visible) */}
                <button 
                  onClick={() => toggleExpand(student.nis)}
                  className="w-full p-4 flex items-center justify-between active:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex-1 pr-4">
                    <h3 className="font-bold text-slate-800 text-base leading-tight mb-1">{student.name}</h3>
                    <div className="flex flex-wrap items-center text-xs text-slate-500 gap-x-3 gap-y-1">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600">
                        NIS: {student.nis}
                      </span>
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                        {student.count} Mapel terisi
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "font-black text-lg w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors",
                      isExpanded ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"
                    )}>
                      {student.avg}
                    </div>
                    <ChevronDown className={cn(
                      "w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0",
                      isExpanded ? "rotate-180 text-blue-500" : ""
                    )} />
                  </div>
                </button>

                {/* Details (Expanded) */}
                <div 
                  className={cn(
                    "grid transition-all duration-300 ease-in-out",
                    isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="px-3 pb-4 pt-1 space-y-2 md:space-y-0 md:grid md:grid-cols-2 md:gap-3 border-t border-slate-100 mt-1">
                      {student.details.map((detail) => {
                        const isEditingThis = editingRow?.id === detail.id;
                        
                        return (
                          <div key={detail.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                            <div className="flex-1 pr-2">
                              <p className="text-sm font-semibold text-slate-700">{detail.mata_pelajaran}</p>
                              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                <CalendarDays className="w-3 h-3" />
                                {detail.periode}
                              </p>
                            </div>
                            
                            <div className="flex items-center">
                              {isEditingThis ? (
                                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl shadow-sm border border-blue-100">
                                  <input 
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="10"
                                    disabled={isUpdating}
                                    value={editingRow.value}
                                    onChange={(e) => setEditingRow({ ...editingRow, value: e.target.value })}
                                    className="w-14 text-center font-bold text-base py-1 px-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                                    autoFocus
                                  />
                                  <button 
                                    disabled={isUpdating}
                                    onClick={() => handleUpdate(detail.id)}
                                    className="p-1.5 flex items-center justify-center bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                                  >
                                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                  </button>
                                  <button 
                                    disabled={isUpdating}
                                    onClick={() => setEditingRow(null)}
                                    className="p-1.5 flex items-center justify-center bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "font-bold text-sm px-3 py-1.5 bg-white rounded-lg shadow-sm border border-slate-100",
                                    detail.nilai < 0 ? "text-amber-700 bg-amber-50 border-amber-100 italic" : "text-blue-700 text-base"
                                  )}>
                                    {detail.nilai < 0 ? (detail.catatan || 'Gak Masuk') : detail.nilai}
                                  </div>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); startEdit(detail); }}
                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-100"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {/* End Details */}
                
              </div>
            );
          })}
        </div>
      )}

      {/* ADMIN MODAL OVERLAY */}
      <AdminModal 
        showAdminModal={showAdminModal} 
        closeAdminModal={() => setShowAdminModal(false)} 
        fetchData={fetchData} 
        uniqueMapels={uniqueMapels} 
      />

      {/* DETAIL MODAL OVERLAY */}
      {detailModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-5 flex justify-between items-center bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  detailModal.type === 'belumLengkap' ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                )}>
                  {detailModal.type === 'belumLengkap' ? <Clock className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base leading-tight">
                    {detailModal.type === 'belumLengkap' ? 'Belum Lengkap' : 'Belum Diinput'}
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    {detailModal.data.length} Siswi
                  </p>
                </div>
              </div>
              <button onClick={() => setDetailModal({ isOpen: false, type: '', data: [] })} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto bg-slate-50/50">
              {detailModal.data.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <p className="text-slate-700 font-bold mb-1">Wah, Mantap!</p>
                  <p className="text-sm text-slate-500">Tidak ada siswi di kategori ini. Semua aman.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {detailModal.data.map((student, idx) => (
                    <div key={student.nis} className="bg-white p-3.5 rounded-2xl border border-slate-100/80 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] flex items-center gap-3 hover:border-blue-100 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-700 truncate">{student.nama_siswi}</p>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">NIS: {student.nis}</p>
                      </div>
                      {detailModal.type === 'belumLengkap' && (
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 mb-0.5 uppercase tracking-wider">Progress</span>
                          <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100/50">
                            {student.count} / {student.totalMapel}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
