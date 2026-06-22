import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, X, AlertCircle, Loader2, Upload, Trash2, Book } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSiswi } from '../contexts/SiswiContext';
import { TAHUN_AJARANS } from '../lib/years';

export default function AdminModal({ showAdminModal, closeAdminModal, fetchData, uniqueMapels }) {
  const { 
    siswiList, 
    uniqueBagian, 
    fetchSiswi, 
    globalPeriode, 
    globalTahunAjaran,
    mapels,
    isCustomMapels,
    addMapel,
    deleteMapel,
    deleteSiswi
  } = useSiswi();
  
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  // State for Searching Student to Delete
  const [siswiSearchQuery, setSiswiSearchQuery] = useState('');

  // States for Delete Nilai Feature
  const [delTargetBagian, setDelTargetBagian] = useState('SEMUA');
  const [delTargetMapel, setDelTargetMapel] = useState('SEMUA');
  const [delTargetPeriode, setDelTargetPeriode] = useState(globalPeriode || 'SEMUA');
  const [delTargetTahunAjaran, setDelTargetTahunAjaran] = useState(globalTahunAjaran || 'SEMUA');
  const [delTargetKategori, setDelTargetKategori] = useState('SEMUA');

  // State for Managing Dynamic Mapels
  const [newMapelName, setNewMapelName] = useState('');

  const filteredSiswisForDelete = useMemo(() => {
    if (!siswiSearchQuery.trim()) return [];
    const query = siswiSearchQuery.toLowerCase();
    return (siswiList || []).filter(s => 
      (s.nama_siswi && s.nama_siswi.toLowerCase().includes(query)) ||
      (s.nis && s.nis.toLowerCase().includes(query))
    );
  }, [siswiList, siswiSearchQuery]);

  if (!showAdminModal) return null;

  const handleAdminAuth = async (e) => {
    e.preventDefault();
    setAdminLoading(true);
    setAdminError('');
    
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@mazeeda.com',
      password: adminPassword,
    });

    if (!signInError) {
      setIsAdminUnlocked(true);
      setAdminError('');
    } else {
      if (signInError.message.includes('Invalid login credentials')) {
        setAdminError('Password salah!');
      } else {
        setAdminError('Akun admin belum disetting di Supabase!');
      }
    }
    
    setAdminLoading(false);
  };

  const handleClose = async () => {
    // Close modal and reset state without signing the user out.
    closeAdminModal();
    const wasUnlocked = isAdminUnlocked;
    setIsAdminUnlocked(false);
    setAdminPassword('');
    setAdminError('');
    setDelTargetBagian('SEMUA');
    setDelTargetMapel('SEMUA');
    setDelTargetPeriode(globalPeriode || 'SEMUA');
    setDelTargetTahunAjaran(globalTahunAjaran || 'SEMUA');
    setDelTargetKategori('SEMUA');
    setNewMapelName('');
    setSiswiSearchQuery('');
    // Previously the admin modal signed the user out on close, which caused unexpected logouts.
    // This behavior is removed to keep the session active after closing the admin panel.
    // if (wasUnlocked) {
    //   await supabase.auth.signOut();
    // }
  };

  const handleDeleteIndividualSiswi = async (nis, name) => {
    const result = await window.Swal.fire({
      title: 'Hapus Siswi?',
      text: `Yakin ingin menghapus siswi "${name}" (NIS: ${nis}) beserta semua data nilainya secara permanen?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;

    setAdminLoading(true);
    setAdminError('');
    const res = await deleteSiswi(nis);
    setAdminLoading(false);
    if (res.success) {
      window.Swal.fire('Terhapus!', `Siswi "${name}" berhasil dihapus.`, 'success');
      setSiswiSearchQuery('');
      fetchData(); // Refresh parent recap data
    } else {
      setAdminError(res.message || 'Gagal menghapus siswi');
    }
  };

  const handleDeleteAllSiswi = async () => {
    const result = await window.Swal.fire({
      title: 'Peringatan Berbahaya!',
      text: `YAKIN INGIN MENGHAPUS SEMUA DATA MASTER SISWI TAHUN AJARAN ${globalTahunAjaran} PERMANEN?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus Semua!',
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;
    
    setAdminLoading(true);
    setAdminError('');
    const { error } = await supabase.from('siswi').delete().eq('tahun_ajaran', globalTahunAjaran);
    
    setAdminLoading(false);
    if(error){
      setAdminError('Gagal menghapus: ' + error.message);
    } else {
      window.Swal.fire('Berhasil!', `Semua data master siswi Tahun Ajaran ${globalTahunAjaran} berhasil dikosongkan!`, 'success');
      fetchSiswi(); // Refresh context
      fetchData(); // Refresh recap data
    }
  };

  const handleDeleteNilai = async () => {
    const isSemuaBagian = delTargetBagian === 'SEMUA';
    const isSemuaMapel = delTargetMapel === 'SEMUA';
    const isSemuaPeriode = delTargetPeriode === 'SEMUA';
    const isSemuaTahunAjaran = delTargetTahunAjaran === 'SEMUA';
    const isSemuaKategori = delTargetKategori === 'SEMUA';
    
    let msg = `Yakin ingin menghapus riwayat Nilai Tamrin untuk:\nTahun Ajaran: ${delTargetTahunAjaran}\nPeriode: ${delTargetPeriode}\nBagian: ${delTargetBagian}\nPelajaran: ${delTargetMapel}\nKategori: ${delTargetKategori}?`;
    if(isSemuaBagian && isSemuaMapel && isSemuaPeriode && isSemuaTahunAjaran && isSemuaKategori) {
      msg = `PERINGATAN KERAS!\n\nAnda akan menghapus SELURUH Riwayat Nilai Tamrin di database (Semua Tahun Ajaran, Periode, Bagian, Pelajaran, & Kategori)!\n\nLanjutkan?`;
    }

    const result = await window.Swal.fire({
      title: 'Konfirmasi Hapus Nilai',
      html: msg.replace(/\n/g, '<br/>'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Bantai Nilai!',
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;

    setAdminLoading(true);
    setAdminError('');

    try {
      let query = supabase.from('nilai_tamrin').delete();

      // Filter Mapel
      if(!isSemuaMapel) {
        query = query.eq('mata_pelajaran', delTargetMapel);
      } else {
        query = query.neq('mata_pelajaran', 'xxINVALIDxx');
      }

      // Filter Periode
      if(!isSemuaPeriode) {
        query = query.eq('periode', delTargetPeriode);
      }

      // Filter Tahun Ajaran
      if(!isSemuaTahunAjaran) {
        query = query.eq('tahun_ajaran', delTargetTahunAjaran);
      }

      // Filter Kategori
      if(!isSemuaKategori) {
        query = query.eq('kategori', delTargetKategori);
      }

      // Filter Bagian
      if(!isSemuaBagian) {
        const targetNisList = siswiList.filter(s => s.bagian === delTargetBagian).map(s => s.nis);
        if(targetNisList.length === 0) {
          throw new Error(`Tidak ada siswi di bagian ${delTargetBagian}`);
        }
        
        const chunkSize = 500;
        for (let i = 0; i < targetNisList.length; i += chunkSize) {
          const chunk = targetNisList.slice(i, i + chunkSize);
          let subQ = supabase.from('nilai_tamrin').delete();
          if(!isSemuaMapel) subQ = subQ.eq('mata_pelajaran', delTargetMapel);
          else subQ = subQ.neq('mata_pelajaran', 'xxINVALIDxx');
          
          if(!isSemuaPeriode) subQ = subQ.eq('periode', delTargetPeriode);
          if(!isSemuaTahunAjaran) subQ = subQ.eq('tahun_ajaran', delTargetTahunAjaran);
          if(!isSemuaKategori) subQ = subQ.eq('kategori', delTargetKategori);
          
          const res = await subQ.in('nis', chunk);
          if (res.error) throw new Error(res.error.message);
        }
        
      } else {
        const { error: delErr } = await query;
        if(delErr) throw new Error(delErr.message);
      }

      window.Swal.fire('Berhasil!', 'Berhasil menghapus nilai sesuai filter!', 'success');
      fetchData(); 
      
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
        const wb = XLSX.read(bstr, { type: 'binary', raw: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        // Fetch old student list from database for this tahun_ajaran to map existing NIS
        const { data: oldSiswis, error: fetchOldErr } = await supabase
          .from('siswi')
          .select('nis, nama_siswi')
          .eq('tahun_ajaran', globalTahunAjaran);
          
        if (fetchOldErr) throw new Error('Gagal mengambil data lama: ' + fetchOldErr.message);

        const oldSiswiMap = {}; // name -> nis
        (oldSiswis || []).forEach(s => {
          if (s.nama_siswi && s.nis) {
            oldSiswiMap[s.nama_siswi.trim().toLowerCase()] = s.nis.trim();
          }
        });

        const seenNis = new Set();
        const nisChanges = []; // { oldNis, newNis }

        const formattedData = rawData.map(row => {
          const rNis = row['nis'] || row['NIS'] || row['Nis'] || row['nomor_induk'] || row['no_induk'] || row['No Induk'] || row['NO INDUK'];
          const rName = row['nama_siswi'] || row['Nama Siswi'] || row['NAMA SISWI'] || row['nama'] || row['Nama'];
          const rBgn = row['bagian'] || row['Bagian'] || row['BAGIAN'] || row['kelas'];
          
          if (!rName) return null;
          
          const normalizedName = String(rName).trim();
          const lowerName = normalizedName.toLowerCase();
          const oldNis = oldSiswiMap[lowerName];
          
          let finalNis = null;
          
          if (rNis && String(rNis).trim() !== '') {
            finalNis = String(rNis).trim();
            if (oldNis && oldNis !== finalNis) {
              nisChanges.push({ oldNis, newNis: finalNis });
            }
          } else {
            if (oldNis) {
              finalNis = oldNis;
            } else {
              const nameAbbr = normalizedName.replace(/[^a-zA-Z]/g, '').substring(0, 8).toUpperCase() || 'SISWI';
              const randNum = Math.floor(1000 + Math.random() * 9000);
              finalNis = `TEMP-${nameAbbr}-${randNum}`;
            }
          }
          
          return {
            nis: finalNis,
            nama_siswi: normalizedName,
            bagian: rBgn ? String(rBgn).trim() : 'Lainnya',
            tahun_ajaran: globalTahunAjaran
          };
        })
        .filter(d => d !== null)
        .filter(d => {
          if (!d.nis || !d.nama_siswi) return false;
          if (seenNis.has(d.nis)) {
            let checkNis = d.nis;
            let counter = 1;
            while (seenNis.has(checkNis)) {
              checkNis = `${d.nis}-${counter}`;
              counter++;
            }
            d.nis = checkNis;
          }
          seenNis.add(d.nis);
          return true;
        });

        if(formattedData.length === 0){
          setAdminError('Gagal: Kolom "nama_siswi" tidak ditemukan di dalam CSV/Excel tersebut.');
          setAdminLoading(false);
          return;
        }

        const delRes = await supabase.from('siswi').delete().eq('tahun_ajaran', globalTahunAjaran);
        if(delRes.error) throw new Error('Gagal hapus data lama: ' + delRes.error.message);

        const insertRes = await supabase.from('siswi').upsert(formattedData, { onConflict: 'nis, tahun_ajaran' });
        if(insertRes.error) throw new Error('Gagal simpan data baru: ' + insertRes.error.message);

        // Update NIS on nilai_tamrin table if NIS changed
        if (nisChanges.length > 0) {
          for (const change of nisChanges) {
            const { error: updateErr } = await supabase
              .from('nilai_tamrin')
              .update({ nis: change.newNis })
              .eq('nis', change.oldNis)
              .eq('tahun_ajaran', globalTahunAjaran);
              
            if (updateErr) {
              console.error(`Gagal memperbarui nilai untuk NIS ${change.oldNis} ke ${change.newNis}:`, updateErr.message);
            }
          }
        }

        window.Swal.fire('Upload Berhasil!', `${formattedData.length} data siswi baru telah ditambahkan untuk Tahun Ajaran ${globalTahunAjaran}.${nisChanges.length > 0 ? `<br><br>Terdeteksi ${nisChanges.length} perubahan NIS, riwayat nilai telah diperbarui otomatis.` : ''}`, 'success');
        handleClose();
        e.target.value = null; 
        fetchSiswi(); // Refresh context siswi
        fetchData(); // Refresh tab data
        
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

  const handleExamUpload = async (e) => {
    const file = e.target.files[0];
    if(!file) return;

    setAdminLoading(true);
    setAdminError('');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', raw: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

        if (rawData.length === 0) {
          throw new Error('File Excel/CSV kosong!');
        }

        // Identify headers
        const firstRow = rawData[0];
        const keys = Object.keys(firstRow);
        
        // Find NIS and Name keys
        const nisKey = keys.find(k => ['nis', 'NIS', 'Nis', 'nomor_induk', 'no_induk', 'No Induk', 'NO INDUK'].includes(k.trim()));
        const nameKey = keys.find(k => ['nama_siswi', 'Nama Siswi', 'NAMA SISWI', 'nama', 'Nama', 'Nama Lengkap'].includes(k.trim()));

        if (!nisKey) {
          throw new Error('Kolom "nis" tidak ditemukan di file Excel/CSV!');
        }

        // Treat any key that is not standard metadata as a subject column
        const metadataKeys = [
          'nis', 'NIS', 'Nis', 'nomor_induk', 'no_induk', 'No Induk', 'NO INDUK',
          'nama_siswi', 'Nama Siswi', 'NAMA SISWI', 'nama', 'Nama', 'Nama Lengkap',
          'bagian', 'Bagian', 'BAGIAN', 'kelas', 'Kelas', 'Tahun Ajaran', 'Priode', 'Rata-Rata', 'Rata-rata', 'RATA-RATA'
        ];
        
        const subjectKeys = keys.filter(k => !metadataKeys.includes(k.trim()));

        if (subjectKeys.length === 0) {
          throw new Error('Tidak ada kolom mata pelajaran yang terdeteksi di dalam file!');
        }

        const upsertPayload = [];

        rawData.forEach(row => {
          let rNis = row[nisKey] ? String(row[nisKey]).trim() : null;
          const rName = nameKey ? String(row[nameKey]).trim() : '';
          
          if (!rNis && rName) {
            // Find matched siswi by name to get her NIS
            const matchedSiswi = (siswiList || []).find(s => s.nama_siswi.trim().toLowerCase() === rName.toLowerCase());
            if (matchedSiswi) {
              rNis = matchedSiswi.nis;
            }
          }
          
          if (!rNis) return;

          subjectKeys.forEach(subjKey => {
            const rawValue = row[subjKey];
            if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') return;

            let score = null;
            let notes = null;

            // Normalize comma decimal separator to dot for string values
            let valStr = String(rawValue).replace(',', '.').trim();
            const parsedNum = Number(valStr);

            if (!isNaN(parsedNum) && valStr !== '') {
              score = parsedNum;
            } else {
              score = -1;
              notes = String(rawValue).trim();
            }

            upsertPayload.push({
              nis: rNis,
              nama_siswi: rName || 'Siswi',
              mata_pelajaran: subjKey.trim(),
              periode: globalPeriode,
              tahun_ajaran: globalTahunAjaran,
              kategori: 'Ujian',
              nilai: score,
              catatan: notes
            });
          });
        });

        if (upsertPayload.length === 0) {
          throw new Error('Tidak ada data nilai ujian yang valid untuk di-upload!');
        }

        const { error: insertErr } = await supabase
          .from('nilai_tamrin')
          .upsert(upsertPayload, { onConflict: 'nis, mata_pelajaran, periode, tahun_ajaran, kategori' });

        if (insertErr) throw new Error('Gagal simpan ke database: ' + insertErr.message);

        window.Swal.fire('Upload Berhasil!', `Mengunggah ${upsertPayload.length} nilai Ujian untuk tahun ajaran ${globalTahunAjaran} periode ${globalPeriode}.`, 'success');
        handleClose();
        e.target.value = null;
        fetchData(); // Refresh recap data

      } catch (err) {
        setAdminError(err.message || 'Terjadi kesalahan upload');
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

  const handleAddMapel = async () => {
    if (!newMapelName.trim()) return;
    setAdminLoading(true);
    setAdminError('');
    const res = await addMapel(newMapelName);
    setAdminLoading(false);
    if (res.success) {
      setNewMapelName('');
    } else {
      setAdminError(res.message || 'Gagal menambahkan mata pelajaran');
    }
  };

  const handleDeleteMapel = async (name) => {
    const result = await window.Swal.fire({
      title: 'Hapus Pelajaran?',
      text: `Yakin ingin menghapus mata pelajaran "${name}" untuk tahun ajaran ${globalTahunAjaran}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal'
    });
    if (!result.isConfirmed) return;
    setAdminLoading(true);
    setAdminError('');
    const res = await deleteMapel(name);
    setAdminLoading(false);
    if (!res.success) {
      setAdminError(res.message || 'Gagal menghapus mata pelajaran');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            Admin System
          </h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1"><X className="w-5 h-5"/></button>
        </div>

        {adminError && (
          <div className="mb-4 bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-100 flex items-start gap-2 flex-shrink-0">
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
            <button type="submit" disabled={adminLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition disabled:opacity-50">
              {adminLoading ? 'Mengecek...' : 'Un-lock Panel'}
            </button>
          </form>
        ) : (
          <div className="space-y-5 overflow-y-auto flex-1 pr-1 custom-scrollbar pb-2">
            
            {/* Master Siswi Upload */}
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 text-center relative overflow-hidden group">
              {adminLoading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-[1px] z-10"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>}
              <Upload className="w-8 h-8 mx-auto text-blue-500 mb-2" />
              <h4 className="font-bold text-slate-800 text-sm">Upload Master Siswi CSV/Excel</h4>
              <p className="text-xs text-slate-500 mt-1 mb-3">Tindakan ini akan <b>MENIMPA</b> semua data siswi yang lama di database secara total.</p>
              
              <div className="relative">
                <input 
                  type="file" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="bg-blue-600 text-white font-semibold text-sm py-2 px-4 rounded-xl shadow cursor-pointer group-hover:bg-blue-700 transition">Pilih File Master</div>
              </div>
            </div>

            {/* Exam Grade Upload */}
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 text-center relative overflow-hidden group">
              {adminLoading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-[1px] z-10"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin" /></div>}
              <Upload className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
              <h4 className="font-bold text-slate-800 text-sm">Upload Excel Nilai Ujian ({globalPeriode})</h4>
              <p className="text-xs text-slate-500 mt-1 mb-3">Unggah berkas tabel nilai ujian (kolom berisi subjek) untuk periode & tahun aktif.</p>
              
              <div className="relative">
                <input 
                  type="file" 
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                  onChange={handleExamUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="bg-emerald-600 text-white font-semibold text-sm py-2 px-4 rounded-xl shadow cursor-pointer group-hover:bg-emerald-700 transition">Pilih File Nilai Ujian</div>
              </div>
            </div>

            {/* Manage Subjects Section */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 relative">
              {adminLoading && <div className="absolute inset-0 bg-white/40 flex items-center justify-center backdrop-blur-[0.5px] z-10 rounded-2xl"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>}
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                <Book className="w-4 h-4 text-blue-600" /> Kelola Pelajaran ({globalTahunAjaran})
              </h4>
              <p className="text-[10px] text-slate-500 mb-3">
                {isCustomMapels 
                  ? "✓ Menggunakan daftar mata pelajaran kustom." 
                  : "ℹ Menggunakan daftar bawaan (11 pelajaran). Tambah/hapus untuk membuat kustom."}
              </p>
              
              {/* Add Mapel Input */}
              <div className="flex gap-2 mb-3">
                <input 
                  type="text" 
                  placeholder="Nama mapel baru..."
                  value={newMapelName}
                  onChange={e => setNewMapelName(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500"
                />
                <button 
                  onClick={handleAddMapel}
                  disabled={adminLoading || !newMapelName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition disabled:opacity-50"
                >
                  Tambah
                </button>
              </div>

              {/* List of current Mapels */}
              <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-xl p-2 bg-white space-y-1.5 custom-scrollbar">
                {mapels.map(m => (
                  <div key={m} className="flex justify-between items-center text-[11px] font-medium text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200/50">
                    <span>{m}</span>
                    <button 
                      onClick={() => handleDeleteMapel(m)}
                      disabled={adminLoading}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition disabled:opacity-50"
                      title="Hapus mata pelajaran"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cari & Hapus Siswi Section */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 relative">
              {adminLoading && <div className="absolute inset-0 bg-white/40 flex items-center justify-center backdrop-blur-[0.5px] z-10 rounded-2xl"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>}
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-2">
                <Trash2 className="w-4 h-4 text-red-500" /> Cari & Hapus Siswi
              </h4>
              <p className="text-[10px] text-slate-500 mb-3">
                Cari berdasarkan nama atau NIS untuk menghapus siswi secara individual beserta seluruh nilainya.
              </p>
              
              <div className="mb-3">
                <input 
                  type="text" 
                  placeholder="Ketik nama atau NIS siswi..."
                  value={siswiSearchQuery}
                  onChange={e => setSiswiSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              {siswiSearchQuery.trim() && (
                <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-xl p-2 bg-white space-y-1.5 custom-scrollbar">
                  {filteredSiswisForDelete.length > 0 ? (
                    filteredSiswisForDelete.map(s => (
                      <div key={s.nis} className="flex justify-between items-center text-[11px] font-medium text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200/50">
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="font-bold truncate">{s.nama_siswi}</span>
                          <span className="text-[9px] text-slate-400">NIS: {s.nis} ({s.bagian || '-'})</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteIndividualSiswi(s.nis, s.nama_siswi)}
                          disabled={adminLoading}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition disabled:opacity-50 flex-shrink-0"
                          title="Hapus siswi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-400 text-center py-2">
                      Siswi tidak ditemukan
                    </div>
                  )}
                </div>
              )}
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

            {/* Hapus Nilai Section */}
            <div className="bg-red-50/50 rounded-2xl p-4 border border-red-100/50 mt-4">
              <h4 className="font-bold text-red-800 text-sm flex items-center gap-2 mb-3">
                <Trash2 className="w-4 h-4" /> Hapus Nilai Tamrin
              </h4>
              
              <div className="space-y-3">
                <div>
                  <select 
                    value={delTargetTahunAjaran} 
                    onChange={e => setDelTargetTahunAjaran(e.target.value)}
                    className="w-full bg-white border border-red-200 rounded-xl p-2.5 text-xs font-medium text-slate-700 outline-none focus:border-red-400"
                  >
                    <option value="SEMUA">Semua Tahun Ajaran</option>
                    {TAHUN_AJARANS.map(ta => (
                      <option key={ta} value={ta}>{ta}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <select 
                    value={delTargetPeriode} 
                    onChange={e => setDelTargetPeriode(e.target.value)}
                    className="w-full bg-white border border-red-200 rounded-xl p-2.5 text-xs font-medium text-slate-700 outline-none focus:border-red-400"
                  >
                    <option value="SEMUA">Semua Periode</option>
                    <option value="Qobla Maulud">Qobla Maulud</option>
                    <option value="Ba'da Maulud">Ba'da Maulud</option>
                  </select>
                </div>

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

                <div>
                  <select 
                    value={delTargetKategori} 
                    onChange={e => setDelTargetKategori(e.target.value)}
                    className="w-full bg-white border border-red-200 rounded-xl p-2.5 text-xs font-medium text-slate-700 outline-none focus:border-red-400"
                  >
                    <option value="SEMUA">Semua Kategori (Tamrin & Ujian)</option>
                    <option value="Tamrin">Hanya Kategori Tamrin</option>
                    <option value="Ujian">Hanya Kategori Ujian</option>
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
  );
}
