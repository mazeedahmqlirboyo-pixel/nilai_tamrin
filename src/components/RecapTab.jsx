import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarDays, Book, Loader2, AlertCircle, ChevronDown, GraduationCap, Edit2, Check, X, Building, Download, Upload, Lock, Trash2 } from 'lucide-react';
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
  
  const [editingRow, setEditingRow] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Admin Modal States
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  // States for Delete Nilai Feature
  const [delTargetBagian, setDelTargetBagian] = useState('SEMUA');
  const [delTargetMapel, setDelTargetMapel] = useState('SEMUA');

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

  const uniqueMapels = useMemo(() => {
    const mpls = new Set();
    data.forEach(d => {
      if(d.mata_pelajaran) mpls.add(d.mata_pelajaran);
    });
    return Array.from(mpls).sort();
  }, [data]);

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

  const handleAdminAuth = (e) => {
    e.preventDefault();
    if (adminPassword === 'cipuyganteng') {
      setIsAdminUnlocked(true);
      setAdminError('');
    } else {
      setAdminError('Password salah!');
    }
  };

  const closeAdminModal = () => {
    setShowAdminModal(false);
    setIsAdminUnlocked(false);
    setAdminPassword('');
    setAdminError('');
    setDelTargetBagian('SEMUA');
    setDelTargetMapel('SEMUA');
  };

  const handleDeleteAllSiswi = async () => {
    if(!window.confirm('YAKIN INGIN MENGHAPUS SEMUA DATA MASTER SISWI PERMANEN?')) return;
    
    setAdminLoading(true);
    setAdminError('');
    // Hack rekayasa untuk menghapus seluruh data pada tabel dengan mencocokkan string kosong yang dikesampingkan.
    const { error } = await supabase.from('siswi').delete().neq('nama_siswi', 'xxINVALIDxx');
    
    setAdminLoading(false);
    if(error){
      setAdminError('Gagal menghapus: ' + error.message);
    } else {
      alert('Semua data master siswi dalam tabel berhasil dikosongkan!');
      fetchData();
    }
  };

  const handleDeleteNilai = async () => {
    const isSemuaBagian = delTargetBagian === 'SEMUA';
    const isSemuaMapel = delTargetMapel === 'SEMUA';
    
    let msg = `Yakin ingin menghapus riwayat Nilai Tamrin untuk:\nBagian: ${delTargetBagian}\nPelajaran: ${delTargetMapel}?`;
    if(isSemuaBagian && isSemuaMapel) {
      msg = `PERINGATAN KERAS!\n\nAnda akan menghapus SELURUH Riwayat Nilai Tamrin di database (Semua Bagian & Semua Pelajaran)!\n\nLanjutkan?`;
    }

    if(!window.confirm(msg)) return;

    setAdminLoading(true);
    setAdminError('');

    try {
      let query = supabase.from('nilai_tamrin').delete();

      // Filter Mapel
      if(!isSemuaMapel) {
        query = query.eq('mata_pelajaran', delTargetMapel);
      } else {
        // Trik Supabase untuk hapus tanpa mapel spesifik
        query = query.neq('mata_pelajaran', 'xxINVALIDxx');
      }

      // Filter Bagian (menggunakan in filtering)
      if(!isSemuaBagian) {
        // Dapatkan semua nama anak pada bagian ini
        const targetNames = siswiData.filter(s => s.bagian === delTargetBagian).map(s => s.nama_siswi);
        if(targetNames.length === 0) {
          throw new Error(`Tidak ada siswi di bagian ${delTargetBagian}`);
        }
        
        // Supabase query ".in('col', arr)" max default aman ribuan element.
        // Kita batch ke dalam max 500 per query supaya ekstra aman kalau datanya massive.
        const chunkSize = 500;
        for (let i = 0; i < targetNames.length; i += chunkSize) {
          const chunk = targetNames.slice(i, i + chunkSize);
          let subQ = supabase.from('nilai_tamrin').delete();
          if(!isSemuaMapel) subQ = subQ.eq('mata_pelajaran', delTargetMapel);
          else subQ = subQ.neq('mata_pelajaran', 'xxINVALIDxx');
          
          const res = await subQ.in('nama_siswi', chunk);
          if (res.error) throw new Error(res.error.message);
        }
        
      } else {
        // Eksekusi langsung jika semua bagian
        const { error: delErr } = await query;
        if(delErr) throw new Error(delErr.message);
      }

      alert('Berhasil menghapus nilai Tamrin sesuai filter!');
      fetchData(); // reload tab data
      
    } catch(err) {
      setAdminError('Hapus Nilai Gagal: ' + err.message);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    setAdminLoading(true);
    setAdminError('');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        // Map header fleksibel (Nama Siswi/nama_siswi/Nama) -> (Bagian/bagian)
        const formattedData = rawData.map(row => {
          const rName = row['nama_siswi'] || row['Nama Siswi'] || row['NAMA SISWI'] || row['nama'] || row['Nama'];
          const rBgn = row['bagian'] || row['Bagian'] || row['BAGIAN'] || row['kelas'];
          return {
            nama_siswi: rName,
            bagian: rBgn || 'Lainnya'
          };
        }).filter(d => Boolean(d.nama_siswi));

        if(formattedData.length === 0){
          setAdminError('Gagal: Kolom "nama_siswi" tidak ditemukan di dalam CSV/Excel tersebut.');
          setAdminLoading(false);
          return;
        }

        // Hapus data lama sesuai permintaan
        const delRes = await supabase.from('siswi').delete().neq('nama_siswi', 'xxINVALIDxx');
        if(delRes.error) {
          throw new Error('Gagal hapus data lama: ' + delRes.error.message);
        }

        // Insert new data (bisa dipotong chunk kalau error Payload Too Large, tapi biasanya < 5000 aman)
        const insertRes = await supabase.from('siswi').insert(formattedData);
        if(insertRes.error) {
          throw new Error('Gagal simpan data baru: ' + insertRes.error.message);
        }

        alert(`Berhasil! ${formattedData.length} data siswi baru telah ditambahkan menimpa data lama.`);
        closeAdminModal();
        e.target.value = null; 
        fetchData(); // reload tab
        
      } catch(err) {
        setAdminError(err.message || 'Terjadi kesalahan sistem');
      } finally {
        setAdminLoading(false);
      }
    };

    reader.onerror = () => {
      setAdminError('Gagal membaca file tersebut.');
      setAdminLoading(false);
    };

    reader.readAsBinaryString(file);
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

      {/* ADMIN MODAL OVERLAY */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeAdminModal}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" />
                Admin System
              </h3>
              <button onClick={closeAdminModal} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1"><X className="w-5 h-5"/></button>
            </div>

            {adminError && (
              <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{adminError}</span>
              </div>
            )}

            {!isAdminUnlocked ? (
              <form onSubmit={handleAdminAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Masukkan Password:</label>
                  <input 
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="••••••••"
                    autoFocus
                  />
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition">
                  Un-lock Panel
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-center relative overflow-hidden group">
                  {adminLoading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-[1px] z-10"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>}
                  <Upload className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                  <h4 className="font-bold text-slate-800 text-sm">Upload CSV / Excel</h4>
                  <p className="text-xs text-slate-500 mt-1 mb-3">Tindakan ini akan <b>MENIMPA</b> semua data siswi yang lama di database secara total.</p>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="bg-blue-600 text-white font-semibold text-sm py-2 px-4 rounded-xl shadow cursor-pointer group-hover:bg-blue-700 transition">Pilih File Data</div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 text-center mt-6">
                  <button 
                    disabled={adminLoading}
                    onClick={handleDeleteAllSiswi} 
                    className="text-red-500 text-xs font-bold flex items-center justify-center gap-1.5 w-full py-2 hover:bg-red-50 rounded-xl transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Kosongkan Semua Nama Master Siswi
                  </button>
                </div>

                <div className="bg-red-50/50 rounded-2xl p-4 border border-red-100/50 mt-4">
                  <h4 className="font-bold text-red-800 text-sm flex items-center gap-2 mb-3">
                    <Trash2 className="w-4 h-4" /> Hapus Nilai Tamrin
                  </h4>
                  
                  <div className="space-y-3">
                    <div>
                      <select 
                        value={delTargetBagian} 
                        onChange={e => setDelTargetBagian(e.target.value)}
                        className="w-full bg-white border border-red-200 rounded-xl p-2.5 text-xs font-medium text-slate-700 outline-none focus:border-red-400"
                      >
                        <option value="SEMUA">Semua Bagian</option>
                        {uniqueBagian.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select 
                        value={delTargetMapel} 
                        onChange={e => setDelTargetMapel(e.target.value)}
                        className="w-full bg-white border border-red-200 rounded-xl p-2.5 text-xs font-medium text-slate-700 outline-none focus:border-red-400"
                      >
                        <option value="SEMUA">Semua Pelajaran</option>
                        {uniqueMapels.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    <button 
                      disabled={adminLoading}
                      onClick={handleDeleteNilai}
                      className="w-full bg-red-600 text-white text-xs font-bold py-2.5 rounded-xl hover:bg-red-700 transition shadow-sm mt-2"
                    >
                      Bantai & Hapus Nilai Tersebut
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
