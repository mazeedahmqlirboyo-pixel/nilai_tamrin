import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';

const SiswiContext = createContext();

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

export function SiswiProvider({ children }) {
  const [siswiList, setSiswiList] = useState([]);
  const [loadingSiswi, setLoadingSiswi] = useState(true);
  const [globalPeriode, setGlobalPeriode] = useState('Qobla Maulud');
  const [globalTahunAjaran, setGlobalTahunAjaran] = useState('2026-2027');

  const [mapels, setMapels] = useState(DEFAULT_MAPELS);
  const [isCustomMapels, setIsCustomMapels] = useState(false);
  const [loadingMapels, setLoadingMapels] = useState(false);

  const taRef = useRef(globalTahunAjaran);
  useEffect(() => {
    taRef.current = globalTahunAjaran;
  }, [globalTahunAjaran]);

  const fetchMapels = async (ta) => {
    setLoadingMapels(true);
    const { data, error } = await supabase
      .from('mata_pelajaran')
      .select('nama_mapel')
      .eq('tahun_ajaran', ta)
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      setMapels(data.map(d => d.nama_mapel));
      setIsCustomMapels(true);
    } else {
      setMapels(DEFAULT_MAPELS);
      setIsCustomMapels(false);
    }
    setLoadingMapels(false);
  };

  const ensureCustomMapels = async (ta) => {
    // If not currently custom, insert all default mapels first
    if (!isCustomMapels) {
      const payload = DEFAULT_MAPELS.map(name => ({
        tahun_ajaran: ta,
        nama_mapel: name
      }));
      const { error } = await supabase.from('mata_pelajaran').insert(payload);
      if (error) {
        console.error("Gagal inisialisasi mapel bawaan:", error);
        throw error;
      }
      setIsCustomMapels(true);
    }
  };

  const addMapel = async (newMapelName) => {
    const trimmed = newMapelName ? newMapelName.trim() : '';
    if (!trimmed) return { success: false, message: 'Nama pelajaran tidak boleh kosong!' };
    
    try {
      await ensureCustomMapels(globalTahunAjaran);
      
      const { error } = await supabase.from('mata_pelajaran').insert({
        tahun_ajaran: globalTahunAjaran,
        nama_mapel: trimmed
      });
      
      if (error) {
        if (error.code === '23505') {
          return { success: false, message: 'Mata pelajaran ini sudah terdaftar!' };
        }
        throw error;
      }
      
      await fetchMapels(globalTahunAjaran);
      return { success: true };
    } catch (err) {
      console.error("Gagal menambah mapel:", err);
      return { success: false, message: err.message };
    }
  };

  const deleteMapel = async (mapelName) => {
    try {
      await ensureCustomMapels(globalTahunAjaran);
      
      const { error } = await supabase
        .from('mata_pelajaran')
        .delete()
        .eq('tahun_ajaran', globalTahunAjaran)
        .eq('nama_mapel', mapelName);
        
      if (error) throw error;
      
      await fetchMapels(globalTahunAjaran);
      return { success: true };
    } catch (err) {
      console.error("Gagal menghapus mapel:", err);
      return { success: false, message: err.message };
    }
  };

  const fetchSiswi = async () => {
    setLoadingSiswi(true);
    const resSettings = await supabase
      .from('app_settings')
      .select('active_periode, active_tahun_ajaran')
      .eq('id', 1)
      .single();

    let activeTa = '2026-2027';
    if (!resSettings.error && resSettings.data) {
      setGlobalPeriode(resSettings.data.active_periode);
      if (resSettings.data.active_tahun_ajaran) {
        setGlobalTahunAjaran(resSettings.data.active_tahun_ajaran);
        activeTa = resSettings.data.active_tahun_ajaran;
      }
    }

    await fetchMapels(activeTa);

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

  const updateGlobalPeriode = async (newPeriode) => {
    const { error } = await supabase.from('app_settings').update({ active_periode: newPeriode }).eq('id', 1);
    if (!error) {
      setGlobalPeriode(newPeriode);
      return true;
    }
    console.error("Gagal update periode:", error);
    return false;
  };

  const updateGlobalTahunAjaran = async (newTa) => {
    const { error } = await supabase.from('app_settings').update({ active_tahun_ajaran: newTa }).eq('id', 1);
    if (!error) {
      setGlobalTahunAjaran(newTa);
      await fetchMapels(newTa);
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
    console.error("Gagal update tahun ajaran:", error);
    return false;
  };

  useEffect(() => {
    fetchSiswi();

    const settingsSubscription = supabase
      .channel('app-settings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'id=eq.1',
        },
        async (payload) => {
          if (payload.new) {
            if (payload.new.active_periode) {
              setGlobalPeriode(payload.new.active_periode);
            }
            if (payload.new.active_tahun_ajaran) {
              const newTa = payload.new.active_tahun_ajaran;
              setGlobalTahunAjaran(newTa);
              await fetchMapels(newTa);
              const resSiswi = await supabase
                .from('siswi')
                .select('nis, nama_siswi, bagian')
                .eq('tahun_ajaran', newTa)
                .order('nama_siswi');
              if (!resSiswi.error && resSiswi.data) {
                setSiswiList(resSiswi.data);
              }
            }
          }
        }
      )
      .subscribe();

    const mapelsSubscription = supabase
      .channel('mata-pelajaran-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mata_pelajaran'
        },
        () => {
          fetchMapels(taRef.current);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(settingsSubscription);
      supabase.removeChannel(mapelsSubscription);
    };
  }, []);

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
      isCustomMapels,
      loadingMapels,
      addMapel,
      deleteMapel
    }}>
      {children}
    </SiswiContext.Provider>
  );
}

export function useSiswi() {
  return useContext(SiswiContext);
}
