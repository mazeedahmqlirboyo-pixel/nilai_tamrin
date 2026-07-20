import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarDays, Book, Loader2, AlertCircle, ChevronDown, GraduationCap, Edit2, Check, X, Building, Download, Upload, Users, CheckCircle, Clock, XCircle, Search, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSiswi } from '../contexts/SiswiContext';
import AdminModal from './AdminModal';
import PremiumSelect from './PremiumSelect';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TAHUN_AJARANS } from '../lib/years';

const PERIODES = ['Qobla Maulud', "Ba'da Maulud"];

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function RecapTab() {
  const { siswiBagianMap, uniqueBagian, loadingSiswi, globalPeriode, globalTahunAjaran, siswiList, mapels } = useSiswi();
  const [selectedKategori, setSelectedKategori] = useState('Tamrin');
  const [selectedBagian, setSelectedBagian] = useState('');
  const [localTahunAjaran, setLocalTahunAjaran] = useState(globalTahunAjaran);
  const [localPeriode, setLocalPeriode] = useState(globalPeriode);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset all filters when switching tabs (Tamrin/Muhafadzoh/Ujian)
  useEffect(() => {
    setLocalTahunAjaran(globalTahunAjaran);
    setLocalPeriode(globalPeriode);
    setSelectedBagian('');
    setSearchQuery('');
  }, [selectedKategori, globalTahunAjaran, globalPeriode]);

  const activeTahun = selectedKategori === 'Tamrin' ? globalTahunAjaran : localTahunAjaran;
  const activePeriode = selectedKategori === 'Tamrin' ? globalPeriode : localPeriode;

  const [resolvedSiswi, setResolvedSiswi] = useState({ list: [], map: {} });
  
  useEffect(() => {
    if (activeTahun === globalTahunAjaran) {
      setResolvedSiswi({ list: siswiList, map: siswiBagianMap });
    }
  }, [siswiList, siswiBagianMap, activeTahun, globalTahunAjaran]);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [expandedNis, setExpandedNis] = useState(null);
  const [editingRow, setEditingRow] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [detailModal, setDetailModal] = useState({ isOpen: false, type: '', data: [] });

  const fetchIdRef = useRef(0);

  const fetchData = async () => {
    const fetchId = ++fetchIdRef.current;
    
    setLoading(true);
    setError(null);
    setEditingRow(null);

    if (activeTahun !== globalTahunAjaran) {
      const { data: siswiData, error: siswiErr } = await supabase
        .from('siswi')
        .select('nis, nama_siswi, bagian')
        .eq('tahun_ajaran', activeTahun)
        .order('nama_siswi');
      
      if (fetchId !== fetchIdRef.current) return;

      if (!siswiErr && siswiData) {
        const map = {};
        siswiData.forEach(s => map[s.nis] = s.bagian);
        setResolvedSiswi({ list: siswiData, map });
      } else {
        setResolvedSiswi({ list: [], map: {} });
      }
    }
    
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
    let query = supabase
        .from('nilai_tamrin')
        .select('*')
        .eq('tahun_ajaran', activeTahun)
        .eq('kategori', selectedKategori)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
        
      if (selectedKategori !== 'Muhafadzoh') {
        query = query.eq('periode', activePeriode);
      }

      const { data: pageData, error: pageError } = await query;

      if (fetchId !== fetchIdRef.current) return;

      if (pageError) {
        setError(pageError.message);
        hasMore = false;
        break;
      }

      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData);
        from += PAGE_SIZE;
        if (pageData.length < PAGE_SIZE) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    if (fetchId !== fetchIdRef.current) return;

    if (!error) setData(allData);
    setLoading(false);
  };

  useEffect(() => {
    if (activePeriode && activeTahun) {
      fetchData();
      
      const channel = supabase
        .channel('realtime:nilai_tamrin')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'nilai_tamrin' }, (payload) => {
          const updatedRecord = payload.new;
          const matchPeriode = selectedKategori === 'Muhafadzoh' || updatedRecord.periode === activePeriode;
          if (matchPeriode && updatedRecord.tahun_ajaran === activeTahun && updatedRecord.kategori === selectedKategori) {
            setData(prev => prev.map(d => d.id === updatedRecord.id ? updatedRecord : d));
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'nilai_tamrin' }, (payload) => {
          const oldRecord = payload.old;
          setData(prev => prev.filter(d => d.id !== oldRecord.id));
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [activePeriode, activeTahun, selectedKategori]);

  const uniqueMapels = useMemo(() => {
    const mplsMap = new Map();
    data.forEach(d => {
      if(d.mata_pelajaran) {
        const urut = d.urutan !== undefined && d.urutan !== null ? d.urutan : 999;
        if (!mplsMap.has(d.mata_pelajaran)) mplsMap.set(d.mata_pelajaran, urut);
        else mplsMap.set(d.mata_pelajaran, Math.min(mplsMap.get(d.mata_pelajaran), urut));
      }
    });
    
    return Array.from(mplsMap.keys()).sort((a, b) => {
      const idxA = mapels.indexOf(a);
      const idxB = mapels.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return mplsMap.get(a) - mplsMap.get(b);
    });
  }, [data, mapels]);

  const parseMuhafadzoh = (item) => {
    let nadzom = item.nilai >= 0 ? item.nilai : '';
    let bayan = '';
    if (item.catatan && item.catatan.includes('|||')) {
      const parts = item.catatan.split('|||');
      if (item.nilai < 0) nadzom = parts[0];
      bayan = parts[1];
    } else {
      if (item.nilai < 0) nadzom = item.catatan;
    }
    return { nadzom, bayan };
  };

  const calculateWorstBayan = (details) => {
    if (!details || details.length === 0) return '';
    let worst = 3; // 3: Jayyid, 2: Mutawassith, 1: Rodi', 0: unknown
    let found = false;
    let firstBayan = '';
    details.forEach(d => {
      const bText = parseMuhafadzoh(d).bayan;
      if (!firstBayan && bText) firstBayan = bText;
      const b = bText.toLowerCase();
      if (b.includes('jayyid')) {
        worst = Math.min(worst, 3);
        found = true;
      } else if (b.includes('mutawasit') || b.includes('mutawassith')) {
        worst = Math.min(worst, 2);
        found = true;
      } else if (b.includes('rodi') || b.includes("rodi'")) {
        worst = Math.min(worst, 1);
        found = true;
      }
    });
    if (!found) return firstBayan; // fallback if words don't match
    if (worst === 1) return "Rodi'";
    if (worst === 2) return "Mutawassith";
    if (worst === 3) return "Jayyid";
    return '';
  };

  const localUniqueBagian = useMemo(() => {
    const bgns = new Set();
    resolvedSiswi.list.forEach(s => {
      if (s.bagian) bgns.add(s.bagian);
    });
    return Array.from(bgns).sort();
  }, [resolvedSiswi.list]);

  const groupedData = useMemo(() => {
    if (!selectedBagian && !searchQuery.trim()) return [];

    const groups = {};
    data.forEach(item => {
      const bgn = resolvedSiswi.map[item.nis];
      if (!selectedBagian || bgn === selectedBagian) {
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

    return Object.entries(groups).map(([nis, val]) => {
      let bayanText = '';
      if (selectedKategori === 'Muhafadzoh' && val.details.length > 0) {
         bayanText = calculateWorstBayan(val.details);
      }
      return {
        nis,
        name: val.nama_siswi,
        avg: val.validCount > 0 ? (val.total / val.validCount).toFixed(1) : '-',
        bayan: bayanText,
        details: val.details,
        count: val.details.length
      };
    }).filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, resolvedSiswi.map, selectedBagian, selectedKategori, searchQuery]);

  const stats = useMemo(() => {
    if (!selectedBagian) return null;
    const siswiBagian = resolvedSiswi.list.filter(s => s.bagian === selectedBagian);
    if (selectedKategori === 'Muhafadzoh') {
      const jayyid = [], mutawassith = [], rodi = [], belum = [];
      siswiBagian.forEach(student => {
        const record = groupedData.find(g => g.nis === student.nis);
        if (!record || record.count === 0) belum.push(student);
        else {
          const bayan = record.bayan.toLowerCase();
          if (bayan.includes('jayyid')) jayyid.push(student);
          else if (bayan.includes('mutawasit') || bayan.includes('mutawassith')) mutawassith.push(student);
          else if (bayan.includes('rodi') || bayan.includes("rodi'")) rodi.push(student);
          else belum.push(student);
        }
      });
      return { type: 'muhafadzoh', total: siswiBagian.length, jayyid, mutawassith, rodi, belum };
    }
    const lengkap = [], belumLengkap = [], belumDiinput = [];
    siswiBagian.forEach(student => {
      const record = groupedData.find(g => g.nis === student.nis);
      if (!record || record.count === 0) belumDiinput.push(student);
      else if (record.count < uniqueMapels.length) belumLengkap.push({ ...student, count: record.count, totalMapel: uniqueMapels.length });
      else lengkap.push(student);
    });
    return { type: 'default', total: siswiBagian.length, lengkap, belumLengkap, belumDiinput };
  }, [selectedBagian, resolvedSiswi.list, groupedData, uniqueMapels, selectedKategori]);

  const overallStats = useMemo(() => {
    if (selectedBagian) return null;
    const allGroups = {};
    data.forEach(item => {
      if (!allGroups[item.nis]) allGroups[item.nis] = { count: 0, items: [] };
      allGroups[item.nis].count += 1;
      allGroups[item.nis].items.push(item);
    });
    if (selectedKategori === 'Muhafadzoh') {
      const belum = [], jayyid = [], mutawassith = [], rodi = [];
      resolvedSiswi.list.forEach(student => {
        const record = allGroups[student.nis];
        if (!record || record.count === 0) belum.push(student);
        else {
          const bayan = calculateWorstBayan(record.items).toLowerCase();
          if (bayan.includes('jayyid')) jayyid.push(student);
          else if (bayan.includes('mutawasit') || bayan.includes('mutawassith')) mutawassith.push(student);
          else if (bayan.includes('rodi') || bayan.includes("rodi'")) rodi.push(student);
          else belum.push(student);
        }
      });
      return { type: 'muhafadzoh', total: resolvedSiswi.list.length, jayyid, mutawassith, rodi, belum };
    }
    const lengkap = [], belumLengkap = [], belumDiinput = [];
    resolvedSiswi.list.forEach(student => {
      const record = allGroups[student.nis];
      if (!record || record.count === 0) belumDiinput.push(student);
      else if (record.count < uniqueMapels.length) belumLengkap.push({ ...student, count: record.count, totalMapel: uniqueMapels.length });
      else lengkap.push(student);
    });
    return { type: 'default', total: resolvedSiswi.list.length, lengkap, belumLengkap, belumDiinput };
  }, [data, resolvedSiswi.list, uniqueMapels, selectedBagian, selectedKategori]);

  const toggleExpand = (nis) => {
    setExpandedNis(prev => prev === nis ? null : nis);
    setEditingRow(null);
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
      .update({ nilai: parseFloat(normalizedVal), catatan: null })
      .eq('id', id);
    setIsUpdating(false);
    if (updErr) {
      console.error(updErr);
      window.Swal.fire('Gagal!', 'Gagal update nilai: ' + updErr.message, 'error');
    } else {
      setData(prev => prev.map(item => item.id === id ? { ...item, nilai: parseFloat(normalizedVal), catatan: null } : item));
      setEditingRow(null);
    }
  };

  const exportToExcel = () => {
    const mapelList = uniqueMapels.length > 0 ? uniqueMapels : [];
    const targetSiswis = selectedBagian ? resolvedSiswi.list.filter(s => s.bagian === selectedBagian) : resolvedSiswi.list;
    const headers = ['Nama Siswi', 'NIS', 'Bagian', ...mapelList, selectedKategori === 'Muhafadzoh' ? 'Bayan' : 'Rata-Rata', 'Periode', 'Tahun Ajaran'];
    const nilaiByNis = {};
    const periodeByNis = {};
    const totalByNis = {};
    data.forEach(item => {
      if (!nilaiByNis[item.nis]) {
        nilaiByNis[item.nis] = {};
        periodeByNis[item.nis] = item.periode;
        totalByNis[item.nis] = { total: 0, count: 0 };
      }
      if (selectedKategori === 'Muhafadzoh') {
         const p = parseMuhafadzoh(item);
         nilaiByNis[item.nis][item.mata_pelajaran] = p.nadzom;
         nilaiByNis[item.nis]['BAYAN'] = p.bayan;
      } else {
         nilaiByNis[item.nis][item.mata_pelajaran] = item.nilai < 0 ? (item.catatan || 'Tidak Hadir') : item.nilai;
      }
      if (item.nilai >= 0) {
        totalByNis[item.nis].total += Number(item.nilai);
        totalByNis[item.nis].count += 1;
      }
    });

    const mapelCells = (nis) => mapelList.map(mapel => {
      const val = nilaiByNis[nis]?.[mapel];
      return val !== undefined && val !== null ? val : '';
    });

    const rows = targetSiswis.map(siswa => {
      const nis = siswa.nis;
      let summaryCol = '';
      if (selectedKategori === 'Muhafadzoh') {
        const studentRecord = groupedData.find(g => g.nis === nis);
        summaryCol = studentRecord ? studentRecord.bayan : '';
      } else {
        summaryCol = totalByNis[nis]?.count > 0 ? parseFloat((totalByNis[nis].total / totalByNis[nis].count).toFixed(1)) : '';
      }
      return [siswa.nama_siswi, nis, resolvedSiswi.map[nis] || '-', ...mapelCells(nis), summaryCol, periodeByNis[nis] || activePeriode, activeTahun];
    });

    rows.sort((a, b) => (a[2] === b[2] ? a[0].localeCompare(b[0]) : a[2].localeCompare(b[2])));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai');
    XLSX.writeFile(wb, 'Rekap_Nilai.xlsx');
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">Rekap Nilai Siswi</h2>
          <div className="flex items-center gap-2">
            <button onClick={exportToExcel} className="text-sm font-semibold text-green-700 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full hover:bg-green-100 transition-colors flex items-center gap-1.5" disabled={data.length === 0}>
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
            </button>
            <button onClick={() => setShowAdminModal(true)} className="text-sm font-semibold text-blue-600 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1.5">
              <Upload className="w-4 h-4" /> <span className="hidden sm:inline">Upload CSV</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mt-4 mb-2">
          <div className="flex-1">
            <label className="text-sm font-semibold text-slate-600 flex items-center gap-1.5 mb-2"><Book className="w-4 h-4 text-blue-400" /> Kategori Nilai</label>
            <div className="flex flex-col gap-2">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl h-[52px]">
                <button 
                  onClick={() => setSelectedKategori('Tamrin')}
                  className={cn("flex-1 text-sm font-bold rounded-xl transition-all", selectedKategori === 'Tamrin' ? "bg-white text-blue-600 shadow-md ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700")}
                >Tamrin</button>
                <button 
                  onClick={() => setSelectedKategori('Muhafadzoh')}
                  className={cn("flex-1 text-sm font-bold rounded-xl transition-all", selectedKategori === 'Muhafadzoh' ? "bg-white text-blue-600 shadow-md ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700")}
                >Muhafadzoh</button>
                <button 
                  onClick={() => setSelectedKategori('Ujian')}
                  className={cn("flex-1 text-sm font-bold rounded-xl transition-all", selectedKategori === 'Ujian' ? "bg-white text-blue-600 shadow-md ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700")}
                >Ujian</button>
              </div>

              {selectedKategori !== 'Tamrin' && (
                <div className="flex gap-2 w-full animate-in slide-in-from-top-2 duration-300">
                  <div className="flex-1">
                    <PremiumSelect
                      value={localTahunAjaran}
                      onChange={setLocalTahunAjaran}
                      options={TAHUN_AJARANS}
                      placeholder="Tahun Ajaran"
                      title="Pilih Tahun Ajaran"
                      icon={CalendarDays}
                      buttonClassName="py-2.5 bg-white border-slate-200 text-slate-700 shadow-sm"
                      activeBgClass="bg-white border-slate-200 text-slate-700"
                    />
                  </div>
                  
                  {selectedKategori !== 'Muhafadzoh' && (
                    <div className="flex-1">
                      <PremiumSelect
                        value={localPeriode}
                        onChange={setLocalPeriode}
                        options={PERIODES}
                        placeholder="Periode"
                        title="Pilih Periode"
                        icon={Clock}
                        buttonClassName="py-2.5 bg-white border-slate-200 text-slate-700 shadow-sm"
                        activeBgClass="bg-white border-slate-200 text-slate-700"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex-1">
            <label className="text-sm font-semibold text-slate-600 flex items-center gap-1.5 mb-2"><Building className="w-4 h-4 text-blue-400" /> Filter Bagian/Kelas</label>
            <PremiumSelect value={selectedBagian} onChange={setSelectedBagian} options={localUniqueBagian} placeholder="-- Pilih Bagian --" title="Pilih Bagian" icon={Building} buttonClassName="py-3 bg-slate-50 border-slate-200 text-slate-700" />
            
            <div className="relative mt-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswi..."
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl pl-9 pr-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

       {/* Stats Monitoring Widget (per selected bagian) */}
{selectedBagian && stats && stats.type === 'default' && (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 
           <div className="bg-white rounded-3xl p-4 border border-blue-50 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center mb-2">
               <Users className="w-4 h-4 text-blue-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{stats.total}</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Siswi</span>
           </div>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'lengkap', data: stats.lengkap })}
             className="bg-white rounded-3xl p-4 border border-green-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-green-50/30 hover:border-green-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-green-50 group-hover:bg-green-100 transition-colors flex items-center justify-center mb-2">
               <CheckCircle className="w-4 h-4 text-green-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{stats.lengkap.length}</span>
             <span className="text-[10px] font-bold text-green-600/70 uppercase tracking-wider group-hover:text-green-600 transition-colors">Sudah Lengkap</span>
           </button>
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

{selectedBagian && stats && stats.type === 'muhafadzoh' && (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 
           <div className="bg-white rounded-3xl p-4 border border-blue-50 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center mb-2">
               <Users className="w-4 h-4 text-blue-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{stats.total}</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Siswi</span>
           </div>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'jayyid', data: stats.jayyid })}
             className="bg-white rounded-3xl p-4 border border-green-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-green-50/30 hover:border-green-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-green-50 group-hover:bg-green-100 transition-colors flex items-center justify-center mb-2">
               <CheckCircle className="w-4 h-4 text-green-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{stats.jayyid.length}</span>
             <span className="text-[10px] font-bold text-green-600/70 uppercase tracking-wider group-hover:text-green-600 transition-colors">Jayyid</span>
           </button>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'mutawassith', data: stats.mutawassith })}
             className="bg-white rounded-3xl p-4 border border-amber-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-amber-50/30 hover:border-amber-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-amber-50 group-hover:bg-amber-100 transition-colors flex items-center justify-center mb-2">
               <Clock className="w-4 h-4 text-amber-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{stats.mutawassith.length}</span>
             <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider group-hover:text-amber-600 transition-colors">Mutawassith</span>
           </button>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'rodi', data: stats.rodi })}
             className="bg-white rounded-3xl p-4 border border-rose-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-rose-50/30 hover:border-rose-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-rose-50 group-hover:bg-rose-100 transition-colors flex items-center justify-center mb-2">
               <XCircle className="w-4 h-4 text-rose-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{stats.rodi.length}</span>
             <span className="text-[10px] font-bold text-rose-600/70 uppercase tracking-wider group-hover:text-rose-600 transition-colors">Rodi'</span>
           </button>
         </div>
       )}

       {/* Overall Stats (when no bagian selected) */}
       {!selectedBagian && overallStats && overallStats.type === 'default' && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
           <div className="bg-white rounded-3xl p-4 border border-blue-50 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center mb-2">
               <Users className="w-4 h-4 text-blue-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{overallStats.total}</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Siswi</span>
           </div>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'lengkap', data: overallStats.lengkap })}
             className="bg-white rounded-3xl p-4 border border-green-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-green-50/30 hover:border-green-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-green-50 group-hover:bg-green-100 transition-colors flex items-center justify-center mb-2">
               <CheckCircle className="w-4 h-4 text-green-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{overallStats.lengkap.length}</span>
             <span className="text-[10px] font-bold text-green-600/70 uppercase tracking-wider group-hover:text-green-600 transition-colors">Sudah Lengkap</span>
           </button>
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

       {!selectedBagian && overallStats && overallStats.type === 'muhafadzoh' && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
           <div className="bg-white rounded-3xl p-4 border border-blue-50 shadow-sm flex flex-col items-center justify-center text-center">
             <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center mb-2">
               <Users className="w-4 h-4 text-blue-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{overallStats.total}</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Siswi</span>
           </div>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'jayyid', data: overallStats.jayyid })}
             className="bg-white rounded-3xl p-4 border border-green-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-green-50/30 hover:border-green-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-green-50 group-hover:bg-green-100 transition-colors flex items-center justify-center mb-2">
               <CheckCircle className="w-4 h-4 text-green-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{overallStats.jayyid.length}</span>
             <span className="text-[10px] font-bold text-green-600/70 uppercase tracking-wider group-hover:text-green-600 transition-colors">Jayyid</span>
           </button>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'mutawassith', data: overallStats.mutawassith })}
             className="bg-white rounded-3xl p-4 border border-amber-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-amber-50/30 hover:border-amber-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-amber-50 group-hover:bg-amber-100 transition-colors flex items-center justify-center mb-2">
               <Clock className="w-4 h-4 text-amber-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{overallStats.mutawassith.length}</span>
             <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider group-hover:text-amber-600 transition-colors">Mutawassith</span>
           </button>
           <button 
             onClick={() => setDetailModal({ isOpen: true, type: 'rodi', data: overallStats.rodi })}
             className="bg-white rounded-3xl p-4 border border-rose-50 shadow-sm flex flex-col items-center justify-center text-center hover:bg-rose-50/30 hover:border-rose-200 transition-all cursor-pointer group">
             <div className="w-8 h-8 rounded-full bg-rose-50 group-hover:bg-rose-100 transition-colors flex items-center justify-center mb-2">
               <XCircle className="w-4 h-4 text-rose-500" />
             </div>
             <span className="text-2xl font-black text-slate-800 mb-0.5">{overallStats.rodi.length}</span>
             <span className="text-[10px] font-bold text-rose-600/70 uppercase tracking-wider group-hover:text-rose-600 transition-colors">Rodi'</span>
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
      ) : !selectedBagian && !searchQuery.trim() ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm opacity-80">
          <div className="w-16 h-16 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Book className="w-8 h-8" />
          </div>
          <h3 className="text-slate-700 font-semibold mb-1">Pilih Bagian / Cari Siswi</h3>
          <p className="text-sm text-slate-500 px-4">Silakan pilih bagian di atas atau cari nama siswi untuk memunculkan daftar nilai.</p>
        </div>
      ) : groupedData.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center mx-auto mb-4">
            <Book className="w-8 h-8" />
          </div>
          <h3 className="text-slate-700 font-semibold mb-1">Belum Ada Data</h3>
          <p className="text-sm text-slate-500">Tidak ada riwayat nilai untuk pencarian / filter ini.</p>
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
                      "font-black px-4 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors",
                      selectedKategori === 'Muhafadzoh' ? "text-base" : "text-lg",
                      isExpanded ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"
                    )}>
                      {selectedKategori === 'Muhafadzoh' ? (student.bayan || '-') : student.avg}
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
                      {[...student.details].sort((a, b) => {
                        const idxA = uniqueMapels.indexOf(a.mata_pelajaran);
                        const idxB = uniqueMapels.indexOf(b.mata_pelajaran);
                        return idxA - idxB;
                      }).map((detail) => {
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
                                    "font-bold text-sm px-3 py-1.5 bg-white rounded-lg shadow-sm border border-slate-100 text-center",
                                    selectedKategori === 'Muhafadzoh' ? "text-blue-700" : (detail.nilai < 0 ? "text-amber-700 bg-amber-50 border-amber-100 italic" : "text-blue-700 text-base")
                                  )}>
                                     {(() => {
                                      if (selectedKategori === 'Muhafadzoh') {
                                        const p = parseMuhafadzoh(detail);
                                        const isNum = typeof p.nadzom === 'number' || (!isNaN(p.nadzom) && String(p.nadzom).trim() !== '');
                                        return (
                                          <div className="flex items-center gap-2">
                                            <span className="text-base font-bold">{p.nadzom}{isNum ? ' Bait' : ''}</span>
                                            {p.bayan && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">{p.bayan}</span>}
                                          </div>
                                        );
                                      }
                                      return detail.nilai < 0 ? (detail.catatan || 'Gak Masuk') : detail.nilai;
                                    })()}
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
                  ['belumLengkap', 'mutawassith'].includes(detailModal.type) ? "bg-amber-100 text-amber-600" : 
                  ['lengkap', 'jayyid'].includes(detailModal.type) ? "bg-green-100 text-green-600" : "bg-rose-100 text-rose-600"
                )}>
                  {['belumLengkap', 'mutawassith'].includes(detailModal.type) ? <Clock className="w-5 h-5" /> : 
                   ['lengkap', 'jayyid'].includes(detailModal.type) ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base leading-tight">
                    {detailModal.type === 'belumLengkap' ? 'Belum Lengkap' : 
                     detailModal.type === 'lengkap' ? 'Sudah Lengkap' : 
                     detailModal.type === 'jayyid' ? 'Jayyid' :
                     detailModal.type === 'mutawassith' ? 'Mutawassith' :
                     detailModal.type === 'rodi' ? "Rodi'" : 'Belum Diinput'}
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
                        <p className="text-xs font-semibold text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>NIS: {student.nis}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="truncate">Bagian: {student.bagian || siswiBagianMap[student.nis] || '-'}</span>
                        </p>
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
