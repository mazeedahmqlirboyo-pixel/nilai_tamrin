import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const SiswiContext = createContext();

export function SiswiProvider({ children }) {
  const [siswiList, setSiswiList] = useState([]);
  const [loadingSiswi, setLoadingSiswi] = useState(true);
  const [globalPeriode, setGlobalPeriode] = useState('Qobla Maulud');

  const fetchSiswi = async () => {
    setLoadingSiswi(true);
    const [resSiswi, resSettings] = await Promise.all([
      supabase.from('siswi').select('nama_siswi, bagian').order('nama_siswi'),
      supabase.from('app_settings').select('active_periode').eq('id', 1).single()
    ]);

    if (!resSiswi.error && resSiswi.data) {
      setSiswiList(resSiswi.data);
    }
    if (!resSettings.error && resSettings.data) {
      setGlobalPeriode(resSettings.data.active_periode);
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

  useEffect(() => {
    fetchSiswi();
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
      map[s.nama_siswi] = s.bagian;
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
      fetchSiswi
    }}>
      {children}
    </SiswiContext.Provider>
  );
}

export function useSiswi() {
  return useContext(SiswiContext);
}
