import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Send, MessageCircle, CheckCircle, Clock, XCircle, Sparkles } from 'lucide-react';

export default function WhatsAppShareModal({
  isOpen,
  onClose,
  kategori = 'Tamrin',
  tahunAjaran = '',
  periode = '',
  currentBagian = '',
  bagianList = [],
  resolvedSiswi = { list: [], map: {} },
  groupedData = [],
  data = [],
  mapels = [],
  uniqueMapels = []
}) {
  // Mode rekap: 'status_bagian' (default - simpel) atau 'nilai_siswi'
  const [recapMode, setRecapMode] = useState('status_bagian');
  const [selectedBagianFilter, setSelectedBagianFilter] = useState('SEMUA');
  const [showCountDetail, setShowCountDetail] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync state saat modal dibuka
  React.useEffect(() => {
    if (isOpen) {
      setSelectedBagianFilter(currentBagian || 'SEMUA');
      setCopied(false);
    }
  }, [isOpen, currentBagian]);

  const targetMapelCount = mapels.length > 0 ? mapels.length : (uniqueMapels.length || 1);

  // Sort bagian secara alami (A1, A2, B1, dst)
  const sortedBagianList = useMemo(() => {
    return [...bagianList].sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [bagianList]);

  // Map data nilai per NIS
  const allGroupMap = useMemo(() => {
    const map = {};
    data.forEach(item => {
      if (!map[item.nis]) {
        map[item.nis] = { details: [], total: 0, validCount: 0 };
      }
      map[item.nis].details.push(item);
      if (item.nilai >= 0) {
        map[item.nis].total += Number(item.nilai);
        map[item.nis].validCount += 1;
      }
    });
    return map;
  }, [data]);

  // Hitung status tiap Bagian (SUDAH LENGKAP, BELUM LENGKAP, BELUM INPUT SAMA SEKALI)
  const bagianStatusList = useMemo(() => {
    return sortedBagianList.map(bgn => {
      const siswiInBgn = resolvedSiswi.list.filter(
        s => (s.bagian || resolvedSiswi.map[s.nis]) === bgn
      );
      const totalSiswi = siswiInBgn.length;

      let siswiLengkap = 0;
      let siswiPunyaNilai = 0;

      siswiInBgn.forEach(s => {
        const entry = allGroupMap[s.nis];
        const count = entry ? entry.details.length : 0;

        if (count > 0) {
          siswiPunyaNilai++;
        }

        if (kategori === 'Muhafadzoh') {
          if (count > 0) siswiLengkap++;
        } else {
          if (count >= targetMapelCount) siswiLengkap++;
        }
      });

      let status = '';
      let statusKey = ''; // 'lengkap' | 'belum_lengkap' | 'belum_input'

      if (totalSiswi === 0 || siswiPunyaNilai === 0) {
        status = 'BELUM INPUT SAMA SEKALI';
        statusKey = 'belum_input';
      } else if (siswiLengkap === totalSiswi) {
        status = 'SUDAH LENGKAP';
        statusKey = 'lengkap';
      } else {
        status = 'BELUM LENGKAP';
        statusKey = 'belum_lengkap';
      }

      return {
        bagian: bgn,
        status,
        statusKey,
        totalSiswi,
        siswiLengkap,
        siswiPunyaNilai
      };
    });
  }, [sortedBagianList, resolvedSiswi, allGroupMap, kategori, targetMapelCount]);

  // Rekap Nilai Siswi (opsional jika user butuh daftar nilai)
  const studentRecapList = useMemo(() => {
    const listSiswi = selectedBagianFilter === 'SEMUA'
      ? resolvedSiswi.list
      : resolvedSiswi.list.filter(s => (s.bagian || resolvedSiswi.map[s.nis]) === selectedBagianFilter);

    return listSiswi.map(student => {
      const val = allGroupMap[student.nis];
      const count = val ? val.details.length : 0;
      const avgNum = val && val.validCount > 0 ? Number((val.total / val.validCount).toFixed(1)) : null;

      let bayan = '';
      if (kategori === 'Muhafadzoh' && val && val.details.length > 0) {
        const details = val.details;
        let worst = 3;
        let found = false;
        let firstBayan = '';
        details.forEach(d => {
          let bText = '';
          if (d.catatan && d.catatan.includes('|||')) {
            bText = d.catatan.split('|||')[1] || '';
          }
          if (!firstBayan && bText) firstBayan = bText;
          const b = bText.toLowerCase();
          if (b.includes('jayyid')) { worst = Math.min(worst, 3); found = true; }
          else if (b.includes('mutawasit') || b.includes('mutawassith')) { worst = Math.min(worst, 2); found = true; }
          else if (b.includes('rodi') || b.includes("rodi'")) { worst = Math.min(worst, 1); found = true; }
        });
        bayan = found ? (worst === 1 ? "Rodi'" : worst === 2 ? "Mutawassith" : "Jayyid") : (firstBayan || '-');
      }

      return {
        nama: student.nama_siswi,
        bagian: student.bagian || resolvedSiswi.map[student.nis] || '-',
        avg: avgNum !== null ? avgNum : '-',
        bayan,
        count
      };
    }).sort((a, b) => a.nama.localeCompare(b.nama));
  }, [selectedBagianFilter, resolvedSiswi, allGroupMap, kategori]);

  // Format Teks WhatsApp
  const waText = useMemo(() => {
    const divider = '━━━━━━━━━━━━━━━━━━━━━━';

    // 1. MODE STATUS BAGIAN (SIMPEL: SUDAH LENGKAP / BELUM LENGKAP / BELUM INPUT SAMA SEKALI)
    if (recapMode === 'status_bagian') {
      let lines = [];
      lines.push(`📢 *REKAP STATUS INPUT NILAI*`);
      lines.push(`*ANGKATAN MAZEEDA 32*`);
      lines.push(divider);
      lines.push(`📚 *Kategori:* ${kategori}`);
      lines.push(`📅 *Tahun Ajaran:* ${tahunAjaran}`);
      if (kategori !== 'Muhafadzoh' && periode) {
        lines.push(`⏳ *Periode:* ${periode}`);
      }
      lines.push(divider);
      lines.push('');

      const filteredList = selectedBagianFilter === 'SEMUA'
        ? bagianStatusList
        : bagianStatusList.filter(b => b.bagian === selectedBagianFilter);

      if (filteredList.length === 0) {
        lines.push(`_Belum ada data bagian/kelas._`);
      } else if (filteredList.length === 1) {
        // Tampilan satu bagian tunggal
        const item = filteredList[0];
        const icon = item.statusKey === 'lengkap' ? '✅' : item.statusKey === 'belum_lengkap' ? '⏳' : '❌';
        lines.push(`🏫 *Bagian ${item.bagian}*`);
        lines.push(`📌 *Status:* ${icon} *${item.status}*`);
        if (showCountDetail) {
          lines.push(`👥 Keterangan: ${item.siswiLengkap} dari ${item.totalSiswi} siswi lengkap`);
        }
      } else {
        // Tampilan daftar seluruh bagian
        filteredList.forEach((item, idx) => {
          const icon = item.statusKey === 'lengkap' ? '✅' : item.statusKey === 'belum_lengkap' ? '⏳' : '❌';
          let line = `${idx + 1}. *Bagian ${item.bagian}* : ${icon} *${item.status}*`;
          if (showCountDetail && item.statusKey === 'belum_lengkap') {
            line += ` (${item.siswiLengkap}/${item.totalSiswi} Siswi)`;
          }
          lines.push(line);
        });
      }

      if (customNote.trim()) {
        lines.push('');
        lines.push(`📝 *Catatan:*`);
        lines.push(customNote.trim());
      } else {
        lines.push('');
        lines.push(`_Mohon bagian yang belum lengkap atau belum input sama sekali untuk segera diselesaikan. Syukron._ 🙏`);
      }

      lines.push('');
      lines.push(divider);
      lines.push(`_Sistem Informasi Nilai Angkatan Mazeeda 32_`);

      return lines.join('\n');
    }

    // 2. MODE NILAI SISWI
    let lines = [];
    lines.push(`📊 *REKAP NILAI SISWI*`);
    lines.push(`*ANGKATAN MAZEEDA 32*`);
    lines.push(divider);
    lines.push(`📚 *Kategori:* ${kategori}`);
    lines.push(`📅 *Tahun Ajaran:* ${tahunAjaran}`);
    if (kategori !== 'Muhafadzoh' && periode) {
      lines.push(`⏳ *Periode:* ${periode}`);
    }
    lines.push(`🏫 *Bagian:* ${selectedBagianFilter === 'SEMUA' ? 'Semua Bagian' : 'Bagian ' + selectedBagianFilter}`);
    lines.push(divider);
    lines.push('');

    studentRecapList.forEach((s, idx) => {
      if (kategori === 'Muhafadzoh') {
        lines.push(`${idx + 1}. *${s.nama}* [${s.bagian}] — ${s.bayan || 'Belum Ada'}`);
      } else {
        lines.push(`${idx + 1}. *${s.nama}* [${s.bagian}] — Rata-rata: *${s.avg}*`);
      }
    });

    if (customNote.trim()) {
      lines.push('');
      lines.push(`📝 *Catatan:*`);
      lines.push(customNote.trim());
    }

    lines.push('');
    lines.push(divider);
    lines.push(`_Sistem Informasi Nilai Angkatan Mazeeda 32_`);

    return lines.join('\n');
  }, [
    recapMode,
    kategori,
    tahunAjaran,
    periode,
    selectedBagianFilter,
    bagianStatusList,
    studentRecapList,
    showCountDetail,
    customNote
  ]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(waText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(waText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 flex justify-between items-center bg-emerald-600 text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-emerald-100" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Rekap WhatsApp</h3>
              <p className="text-xs text-emerald-100">Siap disalin atau langsung disebar ke grup WA</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1 bg-slate-50/50">
          
          {/* Pilihan Mode Rekap */}
          <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setRecapMode('status_bagian')}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all text-center ${
                recapMode === 'status_bagian'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Status Input Bagian
            </button>
            <button
              type="button"
              onClick={() => setRecapMode('nilai_siswi')}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all text-center ${
                recapMode === 'nilai_siswi'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Nilai Siswi
            </button>
          </div>

          {/* Pengaturan Filter Bagian */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">
                  Pilih Bagian yang Direkap
                </label>
                <select
                  value={selectedBagianFilter}
                  onChange={(e) => setSelectedBagianFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="SEMUA">Semua Bagian ({sortedBagianList.length} Bagian)</option>
                  {sortedBagianList.map(b => (
                    <option key={b} value={b}>Bagian {b}</option>
                  ))}
                </select>
              </div>

              {recapMode === 'status_bagian' && (
                <div className="w-full sm:w-auto pt-1 sm:pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 select-none">
                    <input
                      type="checkbox"
                      checked={showCountDetail}
                      onChange={(e) => setShowCountDetail(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <span>Sertakan rincian jumlah</span>
                  </label>
                </div>
              )}
            </div>

            {/* Catatan Tambahan (Opsional) */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">
                Catatan / Pengumuman Tambahan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Mohon diselesaikan sebelum jam 12 siang..."
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Kotak Preview Pesan WhatsApp */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Preview Teks WhatsApp
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Format otomatis</span>
            </div>
            
            <pre className="w-full bg-emerald-950 text-emerald-100 p-4 rounded-2xl text-xs font-mono whitespace-pre-wrap break-words max-h-56 overflow-y-auto custom-scrollbar border border-emerald-900 shadow-inner select-all">
              {waText}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className={`w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm transition-all shadow-sm ${
              copied
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Tersalin ke Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-500" />
                <span>Salin Teks Rekap</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition-all shadow-md shadow-emerald-600/20"
          >
            <Send className="w-4 h-4" />
            <span>Kirim Langsung ke WA</span>
          </button>
        </div>
      </div>
    </div>
  );
}
