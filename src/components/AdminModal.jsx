import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, X, AlertCircle, Loader2, Upload, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useSiswi } from '../contexts/SiswiContext';

export default function AdminModal({ showAdminModal, closeAdminModal, fetchData, uniqueMapels }) {
  const { siswiList, uniqueBagian, fetchSiswi, globalPeriode } = useSiswi();
  
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  // States for Delete Nilai Feature
  const [delTargetBagian, setDelTargetBagian] = useState('SEMUA');
  const [delTargetMapel, setDelTargetMapel] = useState('SEMUA');
  const [delTargetPeriode, setDelTargetPeriode] = useState(globalPeriode || 'SEMUA');

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
      await supabase.auth.signOut();
    } else {
      if (signInError.message.includes('Invalid login credentials')) {
        setAdminError('Password salah!');
      } else {
        setAdminError('Akun admin belum disetting di Supabase!');
      }
    }
    
    setAdminLoading(false);
  };

  const handleClose = () => {
    closeAdminModal();
    setIsAdminUnlocked(false);
    setAdminPassword('');
    setAdminError('');
    setDelTargetBagian('SEMUA');
    setDelTargetMapel('SEMUA');
    setDelTargetPeriode(globalPeriode || 'SEMUA');
  };

  const handleDeleteAllSiswi = async () => {
    if(!window.confirm('YAKIN INGIN MENGHAPUS SEMUA DATA MASTER SISWI PERMANEN?')) return;
    
    setAdminLoading(true);
    setAdminError('');
    const { error } = await supabase.from('siswi').delete().neq('nama_siswi', 'xxINVALIDxx');
    
    setAdminLoading(false);
    if(error){
      setAdminError('Gagal menghapus: ' + error.message);
    } else {
      alert('Semua data master siswi dalam tabel berhasil dikosongkan!');
      fetchSiswi(); // Refresh context
      fetchData(); // Refresh recap data
    }
  };

  const handleDeleteNilai = async () => {
    const isSemuaBagian = delTargetBagian === 'SEMUA';
    const isSemuaMapel = delTargetMapel === 'SEMUA';
    const isSemuaPeriode = delTargetPeriode === 'SEMUA';
    
    let msg = `Yakin ingin menghapus riwayat Nilai Tamrin untuk:\nPeriode: ${delTargetPeriode}\nBagian: ${delTargetBagian}\nPelajaran: ${delTargetMapel}?`;
    if(isSemuaBagian && isSemuaMapel && isSemuaPeriode) {
      msg = `PERINGATAN KERAS!\n\nAnda akan menghapus SELURUH Riwayat Nilai Tamrin di database (Semua Periode, Bagian, & Pelajaran)!\n\nLanjutkan?`;
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
        query = query.neq('mata_pelajaran', 'xxINVALIDxx');
      }

      // Filter Periode
      if(!isSemuaPeriode) {
        query = query.eq('periode', delTargetPeriode);
      }

      // Filter Bagian
      if(!isSemuaBagian) {
        const targetNames = siswiList.filter(s => s.bagian === delTargetBagian).map(s => s.nama_siswi);
        if(targetNames.length === 0) {
          throw new Error(`Tidak ada siswi di bagian ${delTargetBagian}`);
        }
        
        const chunkSize = 500;
        for (let i = 0; i < targetNames.length; i += chunkSize) {
          const chunk = targetNames.slice(i, i + chunkSize);
          let subQ = supabase.from('nilai_tamrin').delete();
          if(!isSemuaMapel) subQ = subQ.eq('mata_pelajaran', delTargetMapel);
          else subQ = subQ.neq('mata_pelajaran', 'xxINVALIDxx');
          
          if(!isSemuaPeriode) subQ = subQ.eq('periode', delTargetPeriode);
          
          const res = await subQ.in('nama_siswi', chunk);
          if (res.error) throw new Error(res.error.message);
        }
        
      } else {
        const { error: delErr } = await query;
        if(delErr) throw new Error(delErr.message);
      }

      alert('Berhasil menghapus nilai Tamrin sesuai filter!');
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
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws);

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

        const delRes = await supabase.from('siswi').delete().neq('nama_siswi', 'xxINVALIDxx');
        if(delRes.error) throw new Error('Gagal hapus data lama: ' + delRes.error.message);

        const insertRes = await supabase.from('siswi').insert(formattedData);
        if(insertRes.error) throw new Error('Gagal simpan data baru: ' + insertRes.error.message);

        alert(`Berhasil! ${formattedData.length} data siswi baru telah ditambahkan menimpa data lama.`);
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

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-600" />
            Admin System
          </h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1"><X className="w-5 h-5"/></button>
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
            <button type="submit" disabled={adminLoading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-blue-700 transition disabled:opacity-50">
              {adminLoading ? 'Mengecek...' : 'Un-lock Panel'}
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
