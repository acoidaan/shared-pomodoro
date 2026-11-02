"use client";

import { useEffect, useMemo, useState } from "react";
import { hasFirebase } from "../../lib/firebaseClient";
import { loadSessions } from "../../lib/sessions";

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

  if (!minutesByDay.get(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (minutesByDay.get(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function StatsPage() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSessions()
      .then(setSessions)
      .catch(() =>
        setError(
          "No se pudieron cargar tus estadísticas. Revisa la conexión con Firebase.",
        ),
      );
  }, []);

  const stats = useMemo(() => {
    if (!sessions) return null;

    const now = new Date();
    const today = dayKey(now);
    const minutesByDay = new Map();
    let totalMinutes = 0;
    let pomodoros = 0;

    for (const session of sessions) {
      const date = new Date(session.completed_at);
      const minutes = Number(session.minutes) || 0;
      const key = dayKey(date);
      totalMinutes += minutes;
      minutesByDay.set(key, (minutesByDay.get(key) || 0) + minutes);
      if (session.mode === "pomodoro") pomodoros += 1;
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
        date,
        minutes: minutesByDay.get(dayKey(date)) || 0,
      };
    });
    const weekMinutes = lastSevenDays.reduce((sum, day) => sum + day.minutes, 0);
    const maxDay = Math.max(30, ...lastSevenDays.map((day) => day.minutes));
    const activeDays = [...minutesByDay.values()].filter(Boolean).length;

    return {
      totalMinutes,
      todayMinutes: minutesByDay.get(today) || 0,
      weekMinutes,
      pomodoros,
      totalSessions: sessions.length,
      average:
        sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
      activeDays,
      streak: calculateStreak(minutesByDay),
      lastSevenDays,
      maxDay,
      recent: sessions.slice(0, 12),
    };
  }, [sessions]);

  return (
    <div className="stats-page">
      <div className="stats-header stats-page-head">
        <div>
          <span className="eyebrow">Tu progreso</span>
          <h1>Estadísticas de enfoque</h1>
          <p>
            Una vista sencilla de tu constancia, sin compararte con nadie más.
          </p>
        </div>
        <span className={`data-source ${hasFirebase ? "cloud" : "local"}`}>
          <span /> {hasFirebase ? "Sincronizado con Firebase" : "Guardado localmente"}
        </span>
      </div>

      {error && <div className="banner">{error}</div>}
      {!sessions && !error && <p className="empty-state">Preparando tus datos…</p>}

      {stats && stats.totalSessions === 0 && (
        <div className="stats-empty card">
          <span className="stats-empty-mark">01</span>
          <h2>Tu historial empieza con una sesión.</h2>
          <p>
            Completa un pomodoro y aquí aparecerán tu tiempo, tu ritmo semanal y
            tu racha de concentración.
          </p>
        </div>
      )}

      {stats && stats.totalSessions > 0 && (
        <>
          <div className="summary-grid personal-summary">
            <div className="summary-card featured">
              <span className="summary-index">01</span>
              <div className="value">{formatMinutes(stats.todayMinutes)}</div>
              <div className="label">Concentración de hoy</div>
            </div>
            <div className="summary-card">
              <span className="summary-index">02</span>
              <div className="value">{formatMinutes(stats.weekMinutes)}</div>
              <div className="label">Últimos siete días</div>
            </div>
            <div className="summary-card">
              <span className="summary-index">03</span>
              <div className="value">
                {stats.streak} {stats.streak === 1 ? "día" : "días"}
              </div>
              <div className="label">Racha actual</div>
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
                  <h2>Tu ritmo semanal</h2>
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
                  <span className="eyebrow">Resumen</span>
                  <h2>Tu forma de trabajar</h2>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Sesiones terminadas</dt>
                  <dd>{stats.totalSessions}</dd>
                </div>
                <div>
                  <dt>Pomodoros completados</dt>
                  <dd>{stats.pomodoros}</dd>
                </div>
                <div>
                  <dt>Duración media</dt>
                  <dd>{formatMinutes(stats.average)}</dd>
                </div>
                <div>
                  <dt>Días con actividad</dt>
                  <dd>{stats.activeDays}</dd>
                </div>
              </dl>
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
              {stats.recent.map((session, index) => {
                const date = new Date(session.completed_at);
                return (
                  <div className="feed-item" key={session.id ?? index}>
                    <span
                      className={`session-type-dot ${session.mode === "timer" ? "timer" : ""}`}
                    />
                    <span className="who">
                      <strong>
                        {session.mode === "pomodoro" ? "Pomodoro" : "Temporizador"}
                      </strong>
                      <small>{session.minutes} minutos de concentración</small>
                    </span>
                    {session.roomCode && (
                      <span className="session-room">Sala {session.roomCode}</span>
                    )}
                    <span className="when">{timeAgo(date)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
