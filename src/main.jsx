import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LoginScreen from './LoginScreen.jsx'
import { supabase } from './lib/supabase.js'
import { Loader2 } from 'lucide-react'

function Root() {
  const [session, setSession] = useState(undefined); // undefined = masih loading

  useEffect(() => {
    // Cek sesi yang sudah tersimpan di localStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Dengarkan perubahan auth (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Masih cek sesi — tampilkan loading
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-blue-300 animate-spin" />
          <span className="text-blue-200 text-sm font-semibold">Memuat...</span>
        </div>
      </div>
    );
  }

  // Belum login — tampilkan halaman login
  if (!session) {
    return <LoginScreen />;
  }

  // Sudah login — tampilkan app guru
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
