import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';

const SiswiContext = createContext();

export function SiswiProvider({ children }) {
  const [siswiList, setSiswiList] = useState([]);
  const [loadingSiswi, setLoadingSiswi] = useState(true);
  const [globalPeriode, setGlobalPeriode] = useState('Qobla Maulud');
  const [globalTahunAjaran, setGlobalTahunAjaran] = useState('2026-2027');

  const [mapels, setMapels] = useState([]);
  const [loadingMapels, setLoadingMapels] = useState(false);

  // Refs agar bisa dipakai di dalam realtime subscription tanpa stale closure
  const taRef = useRef(globalTahunAjaran);
  const periodeRef = useRef(globalPeriode);

  useEffect(() => {
    taRef.current = globalTahunAjaran;
  }, [globalTahunAjaran]);

  useEffect(() => {
    periodeRef.current = globalPeriode;
  }, [globalPeriode]);

  // ─── Fetch Mapels (per tahun_ajaran + periode) ───────────────────────────
  const fetchMapels = async (ta, periode) => {
    setLoadingMapels(true);
    const { data, error } = await supabase
      .from('mata_pelajaran')
      .select('nama_mapel')
      .eq('tahun_ajaran', ta)
      .eq('periode', periode)
      .order('id', { ascending: true });

    if (!error && data) {
      setMapels(data.map(d => d.nama_mapel));
    } else {
      // Kosong — tidak ada fallback default. Admin harus isi manual.
      setMapels([]);
    }
    setLoadingMapels(false);
  };

  // ─── Tambah Mapel ─────────────────────────────────────────────────────────
  const addMapel = async (newMapelName) => {
    const trimmed = newMapelName ? newMapelName.trim() : '';
    if (!trimmed) return { success: false, message: 'Nama pelajaran tidak boleh kosong!' };

    try {
      const { error } = await supabase.from('mata_pelajaran').insert({
        tahun_ajaran: globalTahunAjaran,
        periode: globalPeriode,
        nama_mapel: trimmed
      });

      if (error) {
        if (error.code === '23505') {
          return { success: false, message: 'Mata pelajaran ini sudah terdaftar!' };
        }
        throw error;
      }

      await fetchMapels(globalTahunAjaran, globalPeriode);
      return { success: true };
    } catch (err) {
      console.error('Gagal menambah mapel:', err);
      return { success: false, message: err.message };
    }
  };

  // ─── Hapus Mapel ──────────────────────────────────────────────────────────
  const deleteMapel = async (mapelName) => {
    try {
      const { error } = await supabase
        .from('mata_pelajaran')
        .delete()
        .eq('tahun_ajaran', globalTahunAjaran)
        .eq('periode', globalPeriode)
        .eq('nama_mapel', mapelName);

      if (error) throw error;

      await fetchMapels(globalTahunAjaran, globalPeriode);
      return { success: true };
    } catch (err) {
      console.error('Gagal menghapus mapel:', err);
      return { success: false, message: err.message };
    }
  };

  // ─── Hapus Siswi ──────────────────────────────────────────────────────────
  const deleteSiswi = async (nis) => {
    try {
      const { error: errorNilai } = await supabase
        .from('nilai_tamrin')
        .delete()
        .eq('nis', nis)
        .eq('tahun_ajaran', globalTahunAjaran);

      if (errorNilai) throw errorNilai;

      const { error: errorSiswi } = await supabase
        .from('siswi')
        .delete()
        .eq('nis', nis)
        .eq('tahun_ajaran', globalTahunAjaran);

      if (errorSiswi) throw errorSiswi;

      await fetchSiswi();
      return { success: true };
    } catch (err) {
      console.error('Gagal menghapus siswi:', err);
      return { success: false, message: err.message };
    }
  };

  // ─── Fetch Siswi + Settings ───────────────────────────────────────────────
  const fetchSiswi = async () => {
    setLoadingSiswi(true);
    const resSettings = await supabase
      .from('app_settings')
      .select('active_periode, active_tahun_ajaran')
      .eq('id', 1)
      .single();

    let activeTa = '2026-2027';
    let activePeriode = 'Qobla Maulud';

    if (!resSettings.error && resSettings.data) {
      if (resSettings.data.active_periode) {
        setGlobalPeriode(resSettings.data.active_periode);
        activePeriode = resSettings.data.active_periode;
        periodeRef.current = resSettings.data.active_periode;
      }
      if (resSettings.data.active_tahun_ajaran) {
        setGlobalTahunAjaran(resSettings.data.active_tahun_ajaran);
        activeTa = resSettings.data.active_tahun_ajaran;
        taRef.current = resSettings.data.active_tahun_ajaran;
      }
    }

    await fetchMapels(activeTa, activePeriode);

    const resSiswi = await supabase
      .from('siswi')
      .select('nis, nama_siswi, bagian')
      .eq('tahun_ajaran', activeTa)
      .order('nama_siswi');

    if (!resSiswi.error && resSiswi.data) {
      setSiswiList(resSiswi.data);
    }
    setLoadingSiswi(false);
  };

  // ─── Update Periode Global ─────────────────────────────────────────────────
  const updateGlobalPeriode = async (newPeriode) => {
    const { error } = await supabase.from('app_settings').update({ active_periode: newPeriode }).eq('id', 1);
    if (!error) {
      setGlobalPeriode(newPeriode);
      periodeRef.current = newPeriode;
      // Fetch mapels untuk kombinasi tahun_ajaran + periode baru
      await fetchMapels(taRef.current, newPeriode);
      return true;
    }
    console.error('Gagal update periode:', error);
    return false;
  };

  // ─── Update Tahun Ajaran Global ────────────────────────────────────────────
  const updateGlobalTahunAjaran = async (newTa) => {
    const { error } = await supabase.from('app_settings').update({ active_tahun_ajaran: newTa }).eq('id', 1);
    if (!error) {
      setGlobalTahunAjaran(newTa);
      taRef.current = newTa;
      // Fetch mapels untuk kombinasi tahun_ajaran baru + periode saat ini
      await fetchMapels(newTa, periodeRef.current);
      const resSiswi = await supabase
        .from('siswi')
        .select('nis, nama_siswi, bagian')
        .eq('tahun_ajaran', newTa)
        .order('nama_siswi');
      if (!resSiswi.error && resSiswi.data) {
        setSiswiList(resSiswi.data);
      }
      return true;
    }
    console.error('Gagal update tahun ajaran:', error);
    return false;
  };

  // ─── Initial Load + Realtime Subscriptions ────────────────────────────────
  useEffect(() => {
    fetchSiswi();

    const settingsSubscription = supabase
      .channel('app-settings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.1' },
        async (payload) => {
          if (payload.new) {
            let newTa = taRef.current;
            let newPeriode = periodeRef.current;

            if (payload.new.active_periode) {
              setGlobalPeriode(payload.new.active_periode);
              periodeRef.current = payload.new.active_periode;
              newPeriode = payload.new.active_periode;
            }
            if (payload.new.active_tahun_ajaran) {
              setGlobalTahunAjaran(payload.new.active_tahun_ajaran);
              taRef.current = payload.new.active_tahun_ajaran;
              newTa = payload.new.active_tahun_ajaran;

              const resSiswi = await supabase
                .from('siswi')
                .select('nis, nama_siswi, bagian')
                .eq('tahun_ajaran', newTa)
                .order('nama_siswi');
              if (!resSiswi.error && resSiswi.data) {
                setSiswiList(resSiswi.data);
              }
            }

            await fetchMapels(newTa, newPeriode);
          }
        }
      )
      .subscribe();

    const mapelsSubscription = supabase
      .channel('mata-pelajaran-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mata_pelajaran' },
        () => {
          fetchMapels(taRef.current, periodeRef.current);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsSubscription);
      supabase.removeChannel(mapelsSubscription);
    };
  }, []);

  // ─── Derived State ────────────────────────────────────────────────────────
  const uniqueBagian = useMemo(() => {
    const bgns = new Set();
    siswiList.forEach(s => {
      if (s.bagian) bgns.add(s.bagian);
    });
    return Array.from(bgns).sort();
  }, [siswiList]);

  const siswiBagianMap = useMemo(() => {
    const map = {};
    siswiList.forEach(s => {
      map[s.nis] = s.bagian;
    });
    return map;
  }, [siswiList]);

  return (
    <SiswiContext.Provider value={{
      siswiList,
      loadingSiswi,
      uniqueBagian,
      siswiBagianMap,
      globalPeriode,
      updateGlobalPeriode,
      globalTahunAjaran,
      updateGlobalTahunAjaran,
      fetchSiswi,
      mapels,
      loadingMapels,
      addMapel,
      deleteMapel,
      deleteSiswi
    }}>
      {children}
    </SiswiContext.Provider>
  );
}

export function useSiswi() {
  return useContext(SiswiContext);
}
