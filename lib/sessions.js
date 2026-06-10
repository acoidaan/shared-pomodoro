import { supabase } from './supabaseClient';

const LOCAL_KEY = 'pomodoro-amigos-sessions';

// Guarda una sesión completada. Si Supabase no está configurado,
// guarda en localStorage para que la app funcione igualmente en local.
export async function saveSession({ name, mode, minutes }) {
  const row = {
    name,
    mode,
    minutes,
    completed_at: new Date().toISOString(),
  };

  if (supabase) {
    const { error } = await supabase.from('sessions').insert(row);
    if (error) throw error;
    return;
  }

  const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  all.push(row);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
}

// Devuelve las sesiones más recientes primero.
export async function loadSessions() {
  if (supabase) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .order('completed_at', { ascending: false })
      .limit(5000);
    if (error) throw error;
    return data;
  }

  const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  return all.slice().reverse();
}
