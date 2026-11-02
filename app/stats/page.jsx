"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { avatarColor } from "../../lib/avatar";
import { hasFirebase } from "../../lib/firebaseClient";
import { loadSessions } from "../../lib/sessions";
import { useTimer } from "../timer-context";

function formatMinutes(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function timeAgo(date) {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function calculateStreak(minutesByDay) {
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!minutesByDay.get(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (minutesByDay.get(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function StatsDashboard({ roomCode = null }) {
  const { name } = useTimer();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const isRoom = Boolean(roomCode);

  useEffect(() => {
    setSessions(null);
    setError("");
    loadSessions({ roomCode })
      .then(setSessions)
      .catch(() =>
        setError(
          isRoom
            ? "No se pudo cargar el historial de la sala."
            : "No se pudieron cargar tus estadísticas. Revisa la conexión con Firebase.",
        ),
      );
  }, [roomCode, isRoom]);

  const stats = useMemo(() => {
    if (!sessions) return null;

    const now = new Date();
    const today = dayKey(now);
    const minutesByDay = new Map();
    const byUser = new Map();
    let totalMinutes = 0;
    let pomodoros = 0;

    for (const session of sessions) {
      const date = new Date(session.completed_at);
      const minutes = Number(session.minutes) || 0;
      const key = dayKey(date);
      const name = session.name || "Invitado";
      totalMinutes += minutes;
      minutesByDay.set(key, (minutesByDay.get(key) || 0) + minutes);
      if (session.mode === "pomodoro") pomodoros += 1;

      if (!byUser.has(name)) {
        byUser.set(name, { name, minutes: 0, week: 0, sessions: 0 });
      }
      const user = byUser.get(name);
      user.minutes += minutes;
      user.sessions += 1;
    }

    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return {
        key: dayKey(date),
        label: date
          .toLocaleDateString("es-ES", { weekday: "short" })
          .replace(".", ""),
        minutes: minutesByDay.get(dayKey(date)) || 0,
      };
    });
    const weekKeys = new Set(lastSevenDays.map((day) => day.key));
    for (const session of sessions) {
      if (weekKeys.has(dayKey(new Date(session.completed_at)))) {
        const user = byUser.get(session.name || "Invitado");
        user.week += Number(session.minutes) || 0;
      }
    }

    const weekMinutes = lastSevenDays.reduce((sum, day) => sum + day.minutes, 0);
    const leaderboard = [...byUser.values()].sort(
      (a, b) => b.week - a.week || b.minutes - a.minutes,
    );

    return {
      totalMinutes,
      todayMinutes: minutesByDay.get(today) || 0,
      weekMinutes,
      pomodoros,
      totalSessions: sessions.length,
      average: sessions.length ? Math.round(totalMinutes / sessions.length) : 0,
      activeDays: [...minutesByDay.values()].filter(Boolean).length,
      streak: calculateStreak(minutesByDay),
      people: byUser.size,
      leaderboard,
      maxUserWeek: Math.max(1, ...leaderboard.map((user) => user.week)),
      lastSevenDays,
      maxDay: Math.max(30, ...lastSevenDays.map((day) => day.minutes)),
      recent: sessions.slice(0, 12),
    };
  }, [sessions]);

  return (
    <div className="stats-page">
      <div className="stats-header stats-page-head">
        <div>
          <span className="eyebrow">{isRoom ? `Sala ${roomCode}` : "Comunidad"}</span>
          <h1>{isRoom ? "Progreso de la sala" : "Estadísticas compartidas"}</h1>
          <p>
            {isRoom
              ? "El tiempo que habéis dedicado juntos dentro de esta sala."
              : "Compara vuestro tiempo de enfoque y manteneos motivados entre amigos."}
          </p>
        </div>
        <div className="stats-head-actions">
          {isRoom && (
            <Link href={`/room/${roomCode}`} className="btn btn-ghost">
              Volver a la sala
            </Link>
          )}
          <span className={`data-source ${hasFirebase ? "cloud" : "local"}`}>
            <span /> {hasFirebase ? "Sincronizado" : "Guardado localmente"}
          </span>
        </div>
      </div>

      {error && <div className="banner">{error}</div>}
      {!sessions && !error && <p className="empty-state">Preparando los datos…</p>}

      {stats && stats.totalSessions === 0 && (
        <div className="stats-empty card">
          <span className="stats-empty-mark">01</span>
          <h2>{isRoom ? "La sala todavía no tiene historial." : "El grupo todavía no tiene historial."}</h2>
          <p>
            Cuando alguien complete un bloque de concentración aparecerá aquí
            para que podáis seguir el progreso entre todos.
          </p>
          {isRoom && (
            <Link href={`/room/${roomCode}`} className="btn btn-primary">
              Volver al temporizador
            </Link>
          )}
        </div>
      )}

      {stats && stats.totalSessions > 0 && (
        <>
          <div className="summary-grid personal-summary">
            <div className="summary-card featured">
              <span className="summary-index">01</span>
              <div className="value">{formatMinutes(stats.todayMinutes)}</div>
              <div className="label">{isRoom ? "Enfoque de la sala hoy" : "Enfoque total hoy"}</div>
            </div>
            <div className="summary-card">
              <span className="summary-index">02</span>
              <div className="value">{formatMinutes(stats.weekMinutes)}</div>
              <div className="label">Últimos siete días</div>
            </div>
            <div className="summary-card">
              <span className="summary-index">03</span>
              <div className="value">
                {stats.people} {stats.people === 1 ? "persona" : "personas"}
              </div>
              <div className="label">Han contribuido</div>
            </div>
            <div className="summary-card">
              <span className="summary-index">04</span>
              <div className="value">{formatMinutes(stats.totalMinutes)}</div>
              <div className="label">Tiempo acumulado</div>
            </div>
          </div>

          <div className="stats-layout">
            <section className="card weekly-card">
              <div className="stats-section-head">
                <div>
                  <span className="eyebrow">Últimos siete días</span>
                  <h2>{isRoom ? "Ritmo de la sala" : "Ritmo del grupo"}</h2>
                </div>
                <strong>{formatMinutes(stats.weekMinutes)}</strong>
              </div>
              <div className="weekly-chart">
                {stats.lastSevenDays.map((day) => (
                  <div className="weekly-day" key={day.key}>
                    <span className="weekly-value">
                      {day.minutes ? formatMinutes(day.minutes) : ""}
                    </span>
                    <div className="weekly-track">
                      <div
                        className="weekly-bar"
                        style={{
                          height: `${Math.max(4, (day.minutes / stats.maxDay) * 100)}%`,
                          opacity: day.minutes ? 1 : 0.18,
                        }}
                      />
                    </div>
                    <span className="weekly-label">{day.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <aside className="card stats-details">
              <div className="stats-section-head">
                <div>
                  <span className="eyebrow">Participantes</span>
                  <h2>Aportación semanal</h2>
                </div>
              </div>
              <div className="room-ranking">
                {stats.leaderboard.map((user) => (
                  <div
                    className={`room-ranking-row ${user.name === name ? "is-me" : ""}`}
                    key={user.name}
                  >
                    <span className="avatar" style={{ background: avatarColor(user.name) }}>
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>
                        {user.name}
                        {user.name === name && <small className="ranking-me">Tú</small>}
                      </strong>
                      <span>{user.sessions} {user.sessions === 1 ? "sesión" : "sesiones"}</span>
                      <div className="room-ranking-track">
                        <span style={{ width: `${(user.week / stats.maxUserWeek) * 100}%` }} />
                      </div>
                    </div>
                    <small>{formatMinutes(user.week)}</small>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <section className="recent-section">
            <div className="stats-section-head">
              <div>
                <span className="eyebrow">Historial</span>
                <h2>Sesiones recientes</h2>
              </div>
            </div>
            <div className="feed personal-feed">
              {stats.recent.map((session, index) => (
                <div className="feed-item" key={session.id ?? index}>
                  <span className={`session-type-dot ${session.mode === "timer" ? "timer" : ""}`} />
                  <span className="who">
                    <strong>
                      {session.name} · {session.mode === "pomodoro" ? "Pomodoro" : "Temporizador"}
                    </strong>
                    <small>{session.minutes} minutos de concentración</small>
                  </span>
                  {!isRoom && session.roomCode && (
                    <span className="session-room">Sala {session.roomCode}</span>
                  )}
                  <span className="when">{timeAgo(new Date(session.completed_at))}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function StatsPage() {
  return <StatsDashboard />;
}
