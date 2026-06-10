"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadSessions } from "../../lib/sessions";
import { avatarColor } from "../../lib/avatar";

const MIN_PER_TOMATO = 60;
const MAX_TOMATOES_SHOWN = 120;
const HEATMAP_WEEKS = 26;
const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

// Sesiones de ejemplo con fechas para enseñar cómo se verá el huerto lleno
// (añade ?demo a la URL). Pseudo-aleatorio determinista: siempre igual.
function demoSessions() {
  const out = [];
  const users = [
    ["Acoid", 0.5],
    ["Marta", 0.35],
    ["Dani", 0.22],
  ];
  const today = new Date();
  for (let i = 0; i < HEATMAP_WEEKS * 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    users.forEach(([name, p], ui) => {
      const r = Math.abs(Math.sin(i * 12.9898 + ui * 78.233) * 43758.5453) % 1;
      if (r < p) {
        out.push({
          name,
          minutes: 25 * (1 + Math.floor((r / p) * 4)),
          completed_at: d.toISOString(),
        });
      }
    });
  }
  return out;
}

function plantStage(rest) {
  if (rest < 15) return { emoji: "🌱", label: "germinando" };
  if (rest < 30) return { emoji: "🌿", label: "creciendo" };
  if (rest < 45) return { emoji: "🪴", label: "cogiendo fuerza" };
  return { emoji: "🌸", label: "a punto de dar fruto" };
}

function formatMinutes(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function dateKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function heatLevel(min) {
  if (!min) return 0;
  if (min < 30) return 1;
  if (min < 60) return 2;
  if (min < 120) return 3;
  return 4;
}

// Cuadrícula estilo GitHub: columnas = semanas (lunes arriba), últimas 26 semanas
function Heatmap({ minutesByDay }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    // Mostrar las semanas más recientes si no cabe entero (móvil)
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7; // 0 = lunes
    const start = new Date(today);
    start.setDate(today.getDate() - dow - (HEATMAP_WEEKS - 1) * 7);
    const out = [];
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        days.push({
          date,
          future: date > today,
          minutes: minutesByDay.get(dateKey(date)) || 0,
        });
      }
      out.push(days);
    }
    return out;
  }, [minutesByDay]);

  return (
    <div className="heatmap-scroll" ref={scrollRef}>
      <div className="heatmap-inner">
        <div className="hm-months">
          {weeks.map((week, i) => {
            const m = week[0].date.getMonth();
            const prev = i > 0 ? weeks[i - 1][0].date.getMonth() : null;
            return (
              <span className="hm-month" key={i}>
                {m !== prev ? MONTHS[m] : ""}
              </span>
            );
          })}
        </div>
        <div className="heatmap">
          <div className="hm-col hm-daylabels">
            {["L", "", "X", "", "V", "", ""].map((d, i) => (
              <span className="hm-daylabel" key={i}>
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week, w) => (
            <div className="hm-col" key={w}>
              {week.map((day, d) => (
                <span
                  key={d}
                  className={`hm-cell hm-${day.future ? "future" : heatLevel(day.minutes)}`}
                  title={
                    day.future
                      ? undefined
                      : `${day.date.toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · ${
                          day.minutes ? formatMinutes(day.minutes) : "sin actividad"
                        }`
                  }
                />
              ))}
            </div>
          ))}
        </div>
        <div className="hm-legend">
          <span>Menos</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span className={`hm-cell hm-${l}`} key={l} />
          ))}
          <span>Más</span>
        </div>
      </div>
    </div>
  );
}

export default function GardenPage() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [myName, setMyName] = useState("");

  useEffect(() => {
    setMyName(localStorage.getItem("pomodoro-amigos-name") || "");
    if (new URLSearchParams(window.location.search).has("demo")) {
      setSessions(demoSessions());
      return;
    }
    loadSessions()
      .then(setSessions)
      .catch(() =>
        setError(
          "No se pudo cargar el huerto. Revisa la configuración de Supabase.",
        ),
      );
  }, []);

  const gardens = useMemo(() => {
    if (!sessions) return null;
    const byUser = new Map();
    for (const s of sessions) {
      const key = s.name || "Anónimo";
      if (!byUser.has(key)) {
        byUser.set(key, { minutes: 0, byDay: new Map() });
      }
      const u = byUser.get(key);
      const min = Number(s.minutes) || 0;
      u.minutes += min;
      if (s.completed_at) {
        const k = dateKey(new Date(s.completed_at));
        u.byDay.set(k, (u.byDay.get(k) || 0) + min);
      }
    }
    const list = [...byUser.entries()].map(([name, u]) => ({
      name,
      minutes: u.minutes,
      byDay: u.byDay,
      tomatoes: Math.floor(u.minutes / MIN_PER_TOMATO),
      rest: u.minutes % MIN_PER_TOMATO,
    }));
    list.sort((a, b) => {
      if (a.name === myName) return -1;
      if (b.name === myName) return 1;
      return b.minutes - a.minutes;
    });
    return list;
  }, [sessions, myName]);

  const groupTomatoes = gardens
    ? gardens.reduce((acc, g) => acc + g.tomatoes, 0)
    : 0;
  const groupMinutes = gardens
    ? gardens.reduce((acc, g) => acc + g.minutes, 0)
    : 0;

  return (
    <div>
      <div className="stats-header">
        <h1>🍅 El huerto</h1>
        <span className="hint">
          Cada {MIN_PER_TOMATO} minutos de enfoque cultivan un tomate
        </span>
      </div>

      {error && <div className="banner">⚠️ {error}</div>}

      {!gardens && !error && <p className="empty-state">Regando…</p>}

      {gardens && gardens.length === 0 && (
        <p className="empty-state">
          El huerto está vacío. ¡Completa tu primera sesión y empieza a
          cultivar! 🌱
        </p>
      )}

      {gardens && gardens.length > 0 && (
        <>
          <div className="garden-group-summary">
            Cosecha del grupo: <strong>{groupTomatoes} 🍅</strong> ·{" "}
            {formatMinutes(groupMinutes)} de enfoque entre todos
          </div>

          <div className="gardens">
            {gardens.map((g) => {
              const isMe = g.name === myName;
              const stage = plantStage(g.rest);
              const shown = Math.min(g.tomatoes, MAX_TOMATOES_SHOWN);
              return (
                <div className="card garden-card" key={g.name}>
                  <div className="garden-head">
                    <span
                      className="avatar"
                      style={{ background: avatarColor(g.name) }}
                    >
                      {g.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="garden-name">
                      {g.name}
                      {isMe && <small> (tú)</small>}
                    </span>
                    <span className="garden-count">
                      {g.tomatoes} 🍅 · {formatMinutes(g.minutes)}
                    </span>
                  </div>

                  <div className="garden-plot">
                    {Array.from({ length: shown }, (_, i) => (
                      <span className="tomato" key={i}>
                        🍅
                      </span>
                    ))}
                    {g.tomatoes > MAX_TOMATOES_SHOWN && (
                      <span className="tomato-more">
                        +{g.tomatoes - MAX_TOMATOES_SHOWN}
                      </span>
                    )}
                    <span className="plant" title={stage.label}>
                      {stage.emoji}
                    </span>
                  </div>

                  <Heatmap minutesByDay={g.byDay} />

                  <div className="garden-progress">
                    <div className="bar-track">
                      <div
                        className="bar-fill garden-bar"
                        style={{ width: `${(g.rest / MIN_PER_TOMATO) * 100}%` }}
                      />
                    </div>
                    <span className="garden-progress-label">
                      {g.rest}/{MIN_PER_TOMATO} min — planta {stage.label}{" "}
                      {stage.emoji}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
