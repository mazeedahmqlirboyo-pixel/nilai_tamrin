import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarDays, Book, Loader2, AlertCircle, ChevronDown, GraduationCap, Edit2, Check, X, Building, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function RecapTab() {
  const [data, setData] = useState([]);
  const [siswiData, setSiswiData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // States for filtering
  const [selectedBagian, setSelectedBagian] = useState('');

  // State for which student accordion is currently open
  const [expandedName, setExpandedName] = useState(null);
  
  // State for inline editing { id: null, value: '' }
  const [editingRow, setEditingRow] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setEditingRow(null); // reset editing on fetch
    
    // Fetch data parallelly
    const [resNilai, resSiswi] = await Promise.all([
      supabase.from('nilai_tamrin').select('*').order('created_at', { ascending: false }),
      supabase.from('siswi').select('nama_siswi, bagian')
    ]);

    if (resNilai.error) {
      setError(resNilai.error.message);
    } else {
      setData(resNilai.data || []);
    }

    if (resSiswi.data) {
      setSiswiData(resSiswi.data);
    }
    
    setLoading(false);
  };

  const uniqueBagian = useMemo(() => {
    const bgns = new Set();
    siswiData.forEach(s => {
      if (s.bagian) bgns.add(s.bagian);
    });
    return Array.from(bgns).sort();
  }, [siswiData]);

  const siswiBagianMap = useMemo(() => {
    const map = {};
    siswiData.forEach(s => {
      map[s.nama_siswi] = s.bagian;
    });
    return map;
  }, [siswiData]);

  // Process and group the raw DB records per student, filtering by selected bagian
  const groupedData = useMemo(() => {
    if (!selectedBagian) return []; // If no bagian selected, don't show anyone

    const groups = {};
    data.forEach(item => {
      const bgn = siswiBagianMap[item.nama_siswi];
      if (bgn === selectedBagian) {
        if (!groups[item.nama_siswi]) {
          groups[item.nama_siswi] = { details: [], total: 0 };
        }
        groups[item.nama_siswi].details.push(item);
        groups[item.nama_siswi].total += Number(item.nilai);
      }
    });

    // Convert object to array, calculate average, and sort alphabetically
    return Object.entries(groups).map(([name, val]) => ({
      name,
      avg: (val.total / val.details.length).toFixed(1),
      details: val.details, // array of records
      count: val.details.length
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data, siswiData, selectedBagian]);

  const toggleExpand = (name) => {
    setExpandedName(prev => prev === name ? null : name);
    setEditingRow(null); // Cancel any active edits when swapping accordion
  };

  const startEdit = (detail) => {
    setEditingRow({ id: detail.id, value: detail.nilai });
  };

  const handleUpdate = async (id) => {
    if (!editingRow || editingRow.value === '') return;
    
    setIsUpdating(true);
    const { error: updErr } = await supabase
      .from('nilai_tamrin')
      .update({ nilai: parseFloat(editingRow.value) })
      .eq('id', id);

    setIsUpdating(false);

    if (updErr) {
      console.error(updErr);
      alert('Gagal update nilai: ' + updErr.message);
    } else {
      // Modify local data immediately so we don't have to refetch all
      setData(prev => prev.map(item => item.id === id ? { ...item, nilai: parseFloat(editingRow.value) } : item));
      setEditingRow(null);
    }
  };

  const exportToExcel = () => {
    // Group data by nama_siswi AND periode
    const fullGroups = {};
    data.forEach(item => {
      const key = `${item.nama_siswi}_${item.periode}`;
      if (!fullGroups[key]) {
        fullGroups[key] = { 
          nama_siswi: item.nama_siswi,
          periode: item.periode,
          details: [], 
          total: 0 
        };
      }
      fullGroups[key].details.push(item);
      fullGroups[key].total += Number(item.nilai);
    });

    const exportData = Object.values(fullGroups).map(val => {
      const row = {
        "Bagian": siswiBagianMap[val.nama_siswi] || '-',
        "Nama Siswi": val.nama_siswi,
        "Priode": val.periode,
        "Rata-Rata": parseFloat((val.total / val.details.length).toFixed(1))
      };
      
      // Jadikan nama mapel murni sebagai header (karena periodenya sudah ada di kolom Priode)
      val.details.forEach(detail => {
        row[detail.mata_pelajaran] = detail.nilai;
      });
      
      return row;
    }).sort((a, b) => {
      // Sort by bagian, then name, then priode
      if (a.Bagian === b.Bagian) {
        if (a["Nama Siswi"] === b["Nama Siswi"]) {
          return a.Priode.localeCompare(b.Priode);
        }
        return a["Nama Siswi"].localeCompare(b["Nama Siswi"]);
      }
      return a.Bagian.localeCompare(b.Bagian);
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap Nilai Tamrin Lengkap");
    XLSX.writeFile(workbook, "Rekap_Nilai_Tamrin.xlsx");
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
              onClick={fetchData} 
              className="text-sm font-semibold text-blue-600 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full hover:bg-blue-100 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        <label className="text-sm font-semibold text-slate-600 mt-2 flex items-center gap-1.5 mb-2">
          <Building className="w-4 h-4 text-blue-400" />
          Filter Bagian/Kelas
        </label>
        
        {loading && uniqueBagian.length === 0 ? (
          <div className="h-12 bg-slate-100 animate-pulse rounded-2xl w-full"></div>
        ) : (
          <div className="relative">
            <select 
              value={selectedBagian} 
              onChange={(e) => setSelectedBagian(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 pl-4 pr-10 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
            >
              <option value="" disabled>-- Pilih Bagian --</option>
              {uniqueBagian.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        )}
      </div>

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
            const isExpanded = expandedName === student.name;
            
            return (
              <div 
                key={student.name} 
                className={cn(
                  "bg-white rounded-3xl shadow-[0_2px_8px_-3px_rgba(6,81,237,0.08)] border transition-all duration-300 overflow-hidden",
                  isExpanded ? "border-blue-200" : "border-blue-50"
                )}
              >
                {/* Header (Always Visible) */}
                <button 
                  onClick={() => toggleExpand(student.name)}
                  className="w-full p-4 flex items-center justify-between active:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex-1 pr-4">
                    <h3 className="font-bold text-slate-800 text-base leading-tight mb-1">{student.name}</h3>
                    <div className="flex items-center text-xs text-slate-500 gap-2">
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
                    <div className="px-3 pb-4 pt-1 space-y-2 border-t border-slate-100 mt-1">
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
                                  <div className="text-blue-700 font-bold text-base px-3 py-1 bg-white rounded-lg shadow-sm border border-slate-100">
                                    {detail.nilai}
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
    </div>
  );
}
