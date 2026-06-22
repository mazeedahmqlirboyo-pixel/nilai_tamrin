import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Search, CalendarDays, BookOpen, AlertCircle, ChevronDown, GraduationCap, Building, Loader2, Printer, ArrowLeft, Award, FileText, X } from 'lucide-react';
import { SiswiProvider, useSiswi } from './contexts/SiswiContext';
import { TAHUN_AJARANS } from './lib/years';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import logoSrc from './assets/logo.png';

const PERIODES = ['Qobla Maulud', "Ba'da Maulud"];
const DEFAULT_MAPELS = [
  'Sullam Taufiq',
  'Fushulul Fikriyah',
  "Qowa'id Shorfiyah",
  'Akhlaq Lil Banat',
  'Tasrif Istilahi',
  "Al-'Ilal",
  'Fathul Mubin',
  "Arba'in An-Nawawi",
  'Tijan Daroini',
  'Tuhfatul Atfal',
  "Imla'"
];

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

function NilaiAppContent() {
  const { 
    globalPeriode, 
    globalTahunAjaran
  } = useSiswi();

  const [localTahunAjaran, setLocalTahunAjaran] = useState('');
  const [localPeriode, setLocalPeriode] = useState('');
  const [kategori, setKategori] = useState('Tamrin');
  
  const [localMapels, setLocalMapels] = useState(DEFAULT_MAPELS);

  const [searchNis, setSearchNis] = useState('');
  const [selectedNis, setSelectedNis] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [grades, setGrades] = useState([]);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // Admin Mode States
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);

  // Toast Notification State
  const [toastMsg, setToastMsg] = useState({ show: false, title: '', message: '', type: 'success' });
  const showToast = (title, message, type = 'success') => {
    setToastMsg({ show: true, title, message, type });
    if (type !== 'loading') {
      setTimeout(() => setToastMsg(prev => ({ ...prev, show: false })), 3500);
    }
  };

  // Admin Mode Search & Filter States
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedBagian, setSelectedBagian] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // PWA Install Prompt States
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Initialize from global settings once loaded
  useEffect(() => {
    if (globalTahunAjaran) setLocalTahunAjaran(globalTahunAjaran);
  }, [globalTahunAjaran]);

  useEffect(() => {
    if (globalPeriode) setLocalPeriode(globalPeriode);
  }, [globalPeriode]);

  // PWA Install prompt listener
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    }
  };

  // Reset search results on academic year or period changes
  useEffect(() => {
    setSelectedNis('');
    setSelectedStudent(null);
    setErrorMsg('');
  }, [localTahunAjaran, localPeriode]);

  // Fetch student list for selected Tahun Ajaran (used when Admin Mode is active)
  const loadStudents = async () => {
    if (!localTahunAjaran) return;
    setLoadingStudents(true);
    const { data, error } = await supabase
      .from('siswi')
      .select('nis, nama_siswi, bagian')
      .eq('tahun_ajaran', localTahunAjaran)
      .order('nama_siswi');
    if (!error && data) {
      setStudents(data);
    }
    setLoadingStudents(false);
  };

  useEffect(() => {
    if (!isAdminUnlocked) {
      setStudents([]);
      return;
    }
    loadStudents();
  }, [localTahunAjaran, isAdminUnlocked]);

  // Fetch subjects for selected Tahun Ajaran
  useEffect(() => {
    async function loadMapels() {
      if (!localTahunAjaran) return;
      const { data, error } = await supabase
        .from('mata_pelajaran')
        .select('nama_mapel')
        .eq('tahun_ajaran', localTahunAjaran)
        .order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        setLocalMapels(data.map(d => d.nama_mapel));
      } else {
        setLocalMapels(DEFAULT_MAPELS);
      }
    }
    loadMapels();
  }, [localTahunAjaran]);

  // Fetch grades for selected student, year, period, and category
  useEffect(() => {
    async function loadGrades() {
      if (!selectedNis || !localTahunAjaran || !localPeriode) {
        setGrades([]);
        return;
      }
      setLoadingGrades(true);
      const { data, error } = await supabase
        .from('nilai_tamrin')
        .select('*')
        .eq('nis', selectedNis)
        .eq('tahun_ajaran', localTahunAjaran)
        .eq('periode', localPeriode)
        .eq('kategori', kategori);
      if (!error && data) {
        setGrades(data);
      }
      setLoadingGrades(false);
    }
    loadGrades();
  }, [selectedNis, localTahunAjaran, localPeriode, kategori]);

  // Handle direct NIS query search
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const trimmedNis = searchNis.trim();
    if (!trimmedNis) {
      setErrorMsg('Masukkan NIS terlebih dahulu!');
      return;
    }

    setSearching(true);
    setErrorMsg('');
    setSelectedStudent(null);
    setSelectedNis('');

    try {
      const { data, error } = await supabase
        .from('siswi')
        .select('nis, nama_siswi, bagian')
        .eq('nis', trimmedNis)
        .eq('tahun_ajaran', localTahunAjaran)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setErrorMsg('Nomor Induk Siswi (NIS) tidak terdaftar untuk Tahun Ajaran ini!');
      } else {
        setSelectedStudent(data);
        setSelectedNis(data.nis);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal terhubung ke database. Periksa jaringan Anda.');
    } finally {
      setSearching(false);
    }
  };

  // Admin Mode login checking
  const handleAdminLogin = async (e) => {
    if (e) e.preventDefault();
    if (!loginPassword) {
      setLoginError('Masukkan password terlebih dahulu!');
      return;
    }

    setLoadingLogin(true);
    setLoginError('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'ayahmazeeda32@gmail.com',
        password: loginPassword,
      });

      if (authError) {
        setLoginError('Password salah!');
      } else {
        setIsAdminUnlocked(true);
        setShowLoginModal(false);
        setLoginPassword('');
        setLoginError('');
      }
    } catch (err) {
      setLoginError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleAdminLogout = () => {
    setIsAdminUnlocked(false);
    setSelectedNis('');
    setSelectedStudent(null);
    setSearchQuery('');
    setSelectedBagian('');
    setSearchNis('');
  };

  const uniqueBagian = useMemo(() => {
    const bgns = new Set();
    students.forEach(s => {
      if (s.bagian) bgns.add(s.bagian);
    });
    return Array.from(bgns).sort();
  }, [students]);

  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (selectedBagian) {
      filtered = filtered.filter(s => s.bagian === selectedBagian);
    }
    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.nama_siswi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nis.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [students, selectedBagian, searchQuery]);

  // Compute final report scores
  const reportDetails = useMemo(() => {
    let total = 0;
    let count = 0;
    const items = localMapels.map(mapel => {
      const match = grades.find(g => g.mata_pelajaran === mapel);
      const score = match ? match.nilai : null;
      const notes = match ? match.catatan : null;
      if (score !== null && score >= 0) {
        total += score;
        count++;
      }
      return {
        name: mapel,
        score: score,
        notes: notes
      };
    });

    const average = count > 0 ? (total / count).toFixed(1) : '-';
    return { items, average };
  }, [localMapels, grades]);

  const raportRef = useRef(null);

  const handleDownload = async () => {
    if (!raportRef.current) return;
    
    showToast("Menyiapkan Gambar", "Mohon tunggu sebentar...", "loading");

    try {
      if (!window.htmlToImage) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error("Gagal memuat library pembuat gambar"));
          document.head.appendChild(script);
        });
      }
      
      if (!window.htmlToImage) {
        throw new Error("Sistem pembuat gambar tidak tersedia.");
      }

      const element = raportRef.current;
      
      const image = await window.htmlToImage.toJpeg(element, { 
        quality: 0.95, 
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        style: {
          margin: '0',
          transform: 'none'
        }
      });
      
      const link = document.createElement("a");
      link.href = image;
      link.download = `RAPORT_${selectedStudent?.nama_siswi?.replace(/\s+/g, '_') || 'SISWI'}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast("Berhasil!", "Gambar raport telah diunduh.", "success");
      
    } catch (err) {
      console.error("Gagal mengunduh raport:", err);
      let errMsg = err.message || String(err);
      if (errMsg.includes('oklab')) {
        errMsg = "Warna oklab tidak didukung. Coba gunakan browser lain.";
      }
      showToast("Gagal Unduh", errMsg, "error");
    }
  };

  // Export data ke Excel dengan urutan kolom dinamis
  const exportToExcel = () => {
    const headers = ['Nama Siswi', 'NIS', 'Bagian', ...localMapels, 'Periode', 'Tahun Ajaran'];
    const row = [
      selectedStudent?.nama_siswi || '',
      selectedStudent?.nis || '',
      selectedStudent?.bagian || '',
      ...localMapels.map(mapel => {
        const g = grades.find(item => item.mata_pelajaran === mapel);
        return g ? g.nilai : '';
      }),
      localPeriode,
      localTahunAjaran,
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, row]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Raport');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `RAPORT_${selectedStudent?.nis || 'SISWI'}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans selection:bg-blue-200">
      
      {/* Dynamic CSS for beautiful print margins & layout */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
          }
          .raport-card {
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
            padding: 1.5rem !important;
          }
        }
      `}</style>

      {/* Install Banner */}
      {showInstallBanner && (
        <div className="bg-blue-700 text-white text-xs flex items-center justify-between px-4 py-2.5 no-print">
          <span className="font-semibold">📲 Simpan sebagai <strong>INFORMASI NILAI</strong> di HP</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="bg-white text-blue-700 font-bold text-[11px] px-3 py-1 rounded-full shadow transition hover:bg-blue-50"
            >
              Instal
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="text-white/60 hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header (Hidden when printing) */}
      <header className="bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 rounded-b-3xl shadow-md py-4 px-4 sticky top-0 z-30 relative overflow-hidden no-print">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-5 rounded-full blur-xl transform translate-x-6 -translate-y-6"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-white opacity-5 rounded-full blur-lg transform -translate-x-4 translate-y-4"></div>

        <div className="flex flex-col sm:flex-row justify-between items-center max-w-lg mx-auto gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <img
              src={logoSrc}
              alt="Logo MAZEEDA"
              className="w-10 h-10 rounded-xl object-contain shadow-md bg-white p-0.5 border border-white/60"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-black tracking-wider text-base block">MAZEEDA</span>
                {isAdminUnlocked && (
                  <span className="bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                    Admin
                  </span>
                )}
              </div>
              <span className="text-blue-100 text-[10px] font-bold tracking-wide uppercase">Pencarian Raport</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {/* Kategori Selector */}
            <select
              value={kategori}
              onChange={e => setKategori(e.target.value)}
              className="bg-white/10 active:bg-white/20 border border-white/20 rounded-full py-1.5 px-3 text-[10px] font-bold text-white transition-all outline-none cursor-pointer"
            >
              <option value="Tamrin" className="text-slate-800 font-medium">Nilai Tamrin</option>
              <option value="Ujian" className="text-slate-800 font-medium">Nilai Ujian</option>
            </select>

            {/* TA Selector */}
            <select
              value={localTahunAjaran}
              onChange={e => setLocalTahunAjaran(e.target.value)}
              className="bg-white/10 active:bg-white/20 border border-white/20 rounded-full py-1.5 px-3 text-[10px] font-bold text-white transition-all outline-none cursor-pointer"
            >
              {TAHUN_AJARANS.map(ta => (
                <option key={ta} value={ta} className="text-slate-800 font-medium">{ta}</option>
              ))}
            </select>

            {/* Periode Selector */}
            <select
              value={localPeriode}
              onChange={e => setLocalPeriode(e.target.value)}
              className="bg-white/10 active:bg-white/20 border border-white/20 rounded-full py-1.5 px-3 text-[10px] font-bold text-white transition-all outline-none cursor-pointer"
            >
              {PERIODES.map(p => (
                <option key={p} value={p} className="text-slate-800 font-medium">{p}</option>
              ))}
            </select>

            {isAdminUnlocked && (
              <button
                onClick={handleAdminLogout}
                className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold py-1.5 px-2.5 rounded-full shadow transition-all"
              >
                Keluar Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="p-4 max-w-lg mx-auto">
        
        {selectedNis && selectedStudent ? (
          /* Report Card view */
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Back Button (no-print) */}
            <div className="flex justify-between items-center no-print">
              <button 
                onClick={() => {
                  setSelectedNis('');
                  setSelectedStudent(null);
                  if (!isAdminUnlocked) {
                    setSearchNis('');
                  }
                }}
                className="flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-4 py-2 rounded-2xl transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali Cari
              </button>
              <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-2xl shadow transition"
                >
                  <Printer className="w-4 h-4" />
                  Unduh Nilai
                </button>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-2xl shadow transition"
                >
                  <FileText className="w-4 h-4" />
                  Unduh Excel
                </button>
            </div>

            {loadingGrades ? (
              <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-md flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                <span className="text-sm font-bold text-slate-500">Memuat Nilai {kategori}...</span>
              </div>
            ) : (
              /* Story-ready Report Card Wrapper */
              <div className="w-full max-w-[400px] mx-auto flex justify-center">
                <div 
                  ref={raportRef}
                  className="bg-gradient-to-b from-white to-blue-50/50 rounded-[2rem] p-6 sm:p-8 border border-slate-100 shadow-2xl print-container raport-card w-full min-h-[711px] flex flex-col relative overflow-hidden shrink-0 m-0"
                >
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-100 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-100 rounded-full blur-2xl opacity-50 translate-y-1/4 -translate-x-1/4 pointer-events-none"></div>
                
                <div className="relative z-10 space-y-4 flex-1 flex flex-col">
                
                {/* Official Header */}
                <div className="text-center pb-4 border-b-2 border-slate-100 relative">
                  <div className="absolute top-0 left-0 w-12 h-12 opacity-15">
                    <GraduationCap className="w-full h-full text-blue-800" />
                  </div>
                  <h2 className="text-lg font-black tracking-wide text-slate-800 uppercase">
                    {kategori === 'Ujian' ? 'Raport Hasil Ujian' : 'Raport Hasil Tamrin'}
                  </h2>
                  <h3 className="text-sm font-bold text-slate-500">TAMRIN MAZEEDA</h3>
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] font-bold text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded-md w-max mx-auto">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Tahun Ajaran {localTahunAjaran} ({localPeriode})
                  </div>
                </div>

                {/* Student Bio info (Compact) */}
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Nama Siswi</span>
                    <span className="text-slate-800 text-xs font-bold">{selectedStudent.nama_siswi}</span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">NIS</span>
                      <span className="text-slate-800 text-xs font-bold">{selectedStudent.nis}</span>
                    </div>
                    <div className="w-px h-6 bg-slate-200"></div>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Kelas</span>
                      <span className="text-slate-800 text-xs font-bold flex items-center gap-1 justify-end">
                        <Building className="w-3 h-3 text-blue-500" />
                        {selectedStudent.bagian || '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score Grid */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hasil Mata Pelajaran</span>
                  <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold">
                          <th className="p-3 w-10 text-center">#</th>
                          <th className="p-3">Mata Pelajaran</th>
                          <th className="p-3 w-24 text-center">Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {reportDetails.items.map((item, idx) => {
                          const isAbsent = item.score !== null && item.score < 0;
                          const hasNoGrade = item.score === null;
                          return (
                            <tr key={item.name} className="hover:bg-slate-50/50 transition">
                              <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                              <td className="p-3 font-semibold">{item.name}</td>
                              <td className="p-3 text-center">
                                {isAbsent ? (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold">
                                    {item.notes || 'Tidak Hadir'}
                                  </span>
                                ) : hasNoGrade ? (
                                  <span className="text-slate-300 font-semibold italic text-[11px]">-</span>
                                ) : (
                                  <span className={cn(
                                    "font-black text-sm px-2 py-0.5 rounded",
                                    item.score >= 7.5 ? "text-green-700" : item.score > 4 ? "text-blue-700" : "text-red-700"
                                  )}>
                                    {item.score}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Section */}
                <div className="flex items-center gap-4 bg-gradient-to-br from-blue-700 to-indigo-800 text-white rounded-3xl p-5 shadow-lg border border-blue-600/30">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-white/20">
                    <Award className="w-10 h-10 text-yellow-300" />
                  </div>
                  <div>
                    <span className="text-[10px] text-blue-100 block uppercase font-bold tracking-wider">Rata-Rata Nilai</span>
                    <span className="text-3xl font-black tracking-tight">{reportDetails.average}</span>
                    <span className="text-[10px] text-blue-200 block mt-0.5">
                      {reportDetails.average !== '-' && parseFloat(reportDetails.average) >= 7.5 
                        ? '★ Predikat: Sangat Baik / Lulus' 
                        : reportDetails.average !== '-' && parseFloat(reportDetails.average) > 4
                        ? '★ Predikat: Baik / Lulus'
                        : reportDetails.average !== '-'
                        ? '★ Predikat: Perlu Peningkatan'
                        : 'Belum ada data nilai numerik'}
                    </span>
                  </div>
                </div>

                {/* (Footer Removed) */}

                </div> {/* End z-10 relative content */}
                </div>
              </div>
            )}
          </div>
        ) : isAdminUnlocked ? (
          /* Admin View (Unlocked Class List browse) */
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Announcement Banner */}
            <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50 text-center space-y-2">
              <FileText className="w-10 h-10 mx-auto text-blue-600" />
              <h2 className="text-base font-black text-slate-800">Cari Hasil Raport (Mode Admin)</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Anda dapat memfilter berdasarkan Kelas/Bagian atau mencari nama siswi secara langsung. Klik nama siswi untuk membuka Raport.
              </p>
            </div>

            {/* Filter & Search Box */}
            <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50 space-y-4">
              
              {/* Class Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pilih Bagian / Kelas</label>
                <div className="relative">
                  <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={selectedBagian}
                    onChange={e => {
                      setSelectedBagian(e.target.value);
                      setSearchQuery('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer appearance-none"
                    disabled={loadingStudents}
                  >
                    <option value="">-- Semua Bagian --</option>
                    {uniqueBagian.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Text Search */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Cari Nama atau NIS</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Ketik nama atau NIS siswi..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                    disabled={loadingStudents}
                  />
                </div>
              </div>

              {/* Student list */}
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Hasil Pencarian ({filteredStudents.length})</span>
                {loadingStudents ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
                    <span className="text-xs text-slate-400 font-semibold">Memuat daftar nama siswi...</span>
                  </div>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-1 rounded-2xl p-1 bg-slate-50 border border-slate-100 custom-scrollbar">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map(student => (
                        <button
                          key={student.nis}
                          onClick={() => {
                            setSelectedStudent(student);
                            setSelectedNis(student.nis);
                          }}
                          className="w-full text-left px-4 py-3 text-xs rounded-xl transition-all font-semibold flex justify-between items-center bg-white border border-slate-100 hover:border-blue-300 hover:text-blue-600 shadow-sm"
                        >
                          <div className="flex flex-col">
                            <span className="text-slate-800 font-bold text-sm">{student.nama_siswi}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">NIS: {student.nis}</span>
                          </div>
                          {student.bagian && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                              {student.bagian}
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="p-5 text-center text-xs font-semibold text-slate-400">Tidak ada siswi ditemukan</div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Logout Admin Button */}
            <button
              onClick={handleAdminLogout}
              className="text-red-500 hover:text-red-700 text-xs font-bold text-center block w-max mx-auto py-2 no-print transition-colors"
            >
              Keluar Mode Admin
            </button>
          </div>
        ) : (
          /* Search view (NIS Only Locked Mode) */
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="space-y-4 animate-in fade-in duration-300">
              {/* Announcement Banner */}
              <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50 text-center space-y-2">
                <FileText className="w-10 h-10 mx-auto text-blue-600" />
                <h2 className="text-base font-black text-slate-800">Cari Hasil Raport</h2>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Pilih jenis nilai (Tamrin/Ujian) di bagian atas, kemudian masukkan Nomor Induk Siswi (NIS) untuk melihat raport hasil belajar secara privat.
                </p>
              </div>

              {/* Search Input Box */}
              <div className="bg-white rounded-3xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-blue-50/50 space-y-4">
                {errorMsg && (
                  <div className="bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nomor Induk Siswi (NIS)</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Contoh: 2026001"
                      value={searchNis}
                      onChange={e => setSearchNis(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                      disabled={searching}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={searching || !searchNis.trim()}
                  className="w-full bg-blue-600 text-white font-bold text-sm py-3.5 rounded-2xl shadow-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mencari Data...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Cari Raport
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Low-profile Admin Login Button */}
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="text-slate-300 hover:text-slate-400 text-[9px] font-normal text-center block w-max mx-auto py-4 no-print transition-colors"
            >
              Login Admin
            </button>
          </div>
        )}

      </main>

      {/* Toast Notification */}
      {toastMsg.show && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className={`rounded-2xl shadow-2xl flex items-center gap-3 px-5 py-4 min-w-[280px] max-w-sm border border-white/10 ${
            toastMsg.type === 'error' ? 'bg-red-600 text-white' : 
            toastMsg.type === 'loading' ? 'bg-blue-600 text-white' : 
            'bg-green-600 text-white'
          }`}>
            {toastMsg.type === 'error' && <AlertCircle className="w-6 h-6 flex-shrink-0" />}
            {toastMsg.type === 'loading' && <Loader2 className="w-6 h-6 animate-spin flex-shrink-0" />}
            {toastMsg.type === 'success' && <Award className="w-6 h-6 flex-shrink-0" />}
            <div>
              <h4 className="font-bold text-sm tracking-wide">{toastMsg.title}</h4>
              {toastMsg.message && <p className="text-xs opacity-90 mt-0.5">{toastMsg.message}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal (passcode: ayahmazeeda) */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                Login Admin
              </h3>
              <button 
                onClick={() => {
                  setShowLoginModal(false);
                  setLoginPassword('');
                  setLoginError('');
                }} 
                className="text-slate-400 hover:bg-slate-100 p-1 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loginError && (
              <div className="mb-4 bg-red-50 text-red-600 text-xs p-3 rounded-xl border border-red-100 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <input 
                type="password"
                placeholder="Masukkan password admin..."
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <button 
                type="submit"
                disabled={loadingLogin}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {loadingLogin ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  'Masuk Mode Admin'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default function NilaiApp() {
  return (
    <SiswiProvider>
      <NilaiAppContent />
    </SiswiProvider>
  );
}
