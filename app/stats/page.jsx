'use client';

import { useEffect, useMemo, useState } from 'react';
import { hasSupabase } from '../../lib/supabaseClient';
import { loadSessions } from '../../lib/sessions';

function formatMinutes(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function timeAgo(date) {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function StatsPage() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const [myName, setMyName] = useState('');

  useEffect(() => {
    setMyName(localStorage.getItem('pomodoro-amigos-name') || '');
    loadSessions()
      .then(setSessions)
      .catch(() => setError('No se pudieron cargar las estadísticas. Revisa la configuración de Supabase.'));
  }, []);

  const stats = useMemo(() => {
    if (!sessions) return null;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const byUser = new Map();
    let totalMinutes = 0;
    let todayMinutes = 0;

    for (const s of sessions) {
      const date = new Date(s.completed_at);
      const minutes = Number(s.minutes) || 0;
      totalMinutes += minutes;
      const isToday = isSameLocalDay(date, now);
      if (isToday) todayMinutes += minutes;

      const key = s.name || 'Anónimo';
      if (!byUser.has(key)) {
        byUser.set(key, { name: key, total: 0, week: 0, today: 0, count: 0, pomodoros: 0 });
      }
      const u = byUser.get(key);
      u.total += minutes;
      u.count += 1;
      if (s.mode === 'pomodoro') u.pomodoros += 1;
      if (date >= weekAgo) u.week += minutes;
      if (isToday) u.today += minutes;
    }

    const leaderboard = [...byUser.values()].sort((a, b) => b.week - a.week || b.total - a.total);
    const maxWeek = Math.max(1, ...leaderboard.map((u) => u.week));

    return {
      leaderboard,
      maxWeek,
      totalMinutes,
      todayMinutes,
      totalSessions: sessions.length,
      people: byUser.size,
      recent: sessions.slice(0, 20),
    };
  }, [sessions]);

  return (
    <div>
      <div className="stats-header">
        <h1>📊 Estadísticas</h1>
        <span className="hint">
          {hasSupabase
            ? 'Datos compartidos de todo el grupo'
            : 'Solo datos de este navegador (Supabase sin configurar)'}
        </span>
      </div>

      {error && <div className="banner">⚠️ {error}</div>}

      {!sessions && !error && <p className="empty-state">Cargando…</p>}

      {stats && stats.totalSessions === 0 && (
        <p className="empty-state">
          Todavía no hay sesiones. ¡Completa tu primer pomodoro y aparecerá aquí! 🍅
        </p>
      )}

      {stats && stats.totalSessions > 0 && (
        <>
          <div className="summary-grid">
            <div className="summary-card">
              <div className="value">{formatMinutes(stats.todayMinutes)}</div>
              <div className="label">Enfoque total hoy (grupo)</div>
            </div>
            <div className="summary-card">
              <div className="value">{formatMinutes(stats.totalMinutes)}</div>
              <div className="label">Enfoque total acumulado</div>
            </div>
            <div className="summary-card">
              <div className="value">{stats.totalSessions}</div>
              <div className="label">Sesiones completadas</div>
            </div>
            <div className="summary-card">
              <div className="value">{stats.people}</div>
              <div className="label">Personas participando</div>
            </div>
          </div>

          <h2 className="section-title">🏆 Ranking de la semana</h2>
          <table className="leaderboard">
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Esta semana</th>
                <th>Hoy</th>
                <th>Total</th>
                <th>Pomodoros</th>
              </tr>
            </thead>
            <tbody>
              {stats.leaderboard.map((u, i) => (
                <tr key={u.name}>
                  <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                  <td className={u.name === myName ? 'me' : ''}>{u.name}</td>
                  <td className="num">
                    <div className="bar-row">
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${(u.week / stats.maxWeek) * 100}%` }} />
                      </div>
                      <span>{formatMinutes(u.week)}</span>
                    </div>
                  </td>
                  <td className="num">{formatMinutes(u.today)}</td>
                  <td className="num">{formatMinutes(u.total)}</td>
                  <td className="num">{u.pomodoros}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="section-title">🕒 Actividad reciente</h2>
          <div className="feed">
            {stats.recent.map((s, i) => {
              const date = new Date(s.completed_at);
              return (
                <div className="feed-item" key={s.id ?? i}>
                  <span className="who">
                    <strong>{s.name}</strong> completó{' '}
                    {s.mode === 'pomodoro' ? 'un pomodoro' : 'un temporizador'} de {s.minutes} min{' '}
                    {s.mode === 'pomodoro' ? '🍅' : '⏱️'}
                  </span>
                  <span className="when">{timeAgo(date)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
