import React, { useState } from 'react';
import { supabase } from './lib/supabase';
import { AlertCircle, Loader2, Lock } from 'lucide-react';
import logoSrc from './assets/logo.png';

const EMAIL = 'ayahmazeeda32@gmail.com';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Masukkan password terlebih dahulu!');
      return;
    }

    setLoading(true);
    setError('');

    // Timeout 10 detik agar tidak loading selamanya
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 10000)
    );

    try {
      const { error: authError } = await Promise.race([
        supabase.auth.signInWithPassword({ email: EMAIL, password }),
        timeoutPromise,
      ]);

      if (authError) {
        setError('Password salah! Silakan coba lagi.');
        setLoading(false);
      }
      // Kalau berhasil, onAuthStateChange di main.jsx otomatis menangani redirect
    } catch (err) {
      if (err.message === 'timeout') {
        setError('Koneksi lambat atau akun belum terdaftar. Periksa jaringan dan coba lagi.');
      } else {
        setError('Terjadi kesalahan. Silakan coba lagi.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 opacity-10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-400 opacity-10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl shadow-2xl mb-4 overflow-hidden">
            <img
              src={logoSrc}
              alt="Logo MAZEEDA"
              className="w-14 h-14 object-contain"
            />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">MAZEEDA</h1>
          <p className="text-blue-200 text-sm font-semibold mt-1">Aplikasi Input Nilai</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-blue-400/30 rounded-xl flex items-center justify-center">
              <Lock className="w-4 h-4 text-blue-100" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">Masuk sebagai Mustahiq</h2>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-500/20 border border-red-400/30 text-red-100 text-xs p-3 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-blue-200 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="Masukkan password..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm text-white placeholder-blue-300/60 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400/50 transition-all"
                autoFocus
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-bold text-sm py-3.5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Masuk
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-blue-300/50 text-[10px] font-medium mt-6">
          Sesi akan tersimpan otomatis
        </p>
      </div>
    </div>
  );
}
