"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSessions } from "../../lib/sessions";
import { avatarColor } from "../../lib/avatar";

const MIN_PER_TOMATO = 60;
const MAX_TOMATOES_SHOWN = 120;

// Sesiones de ejemplo para enseñar cómo se verá el huerto lleno (añade ?demo a la URL)
const DEMO_SESSIONS = [
  { name: "Acoid", minutes: 320 },
  { name: "Marta", minutes: 145 },
  { name: "Dani", minutes: 75 },
];

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

export default function GardenPage() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [myName, setMyName] = useState("");

  useEffect(() => {
    setMyName(localStorage.getItem("pomodoro-amigos-name") || "");
    if (new URLSearchParams(window.location.search).has("demo")) {
      setSessions(DEMO_SESSIONS);
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
      byUser.set(key, (byUser.get(key) || 0) + (Number(s.minutes) || 0));
    }
    const list = [...byUser.entries()].map(([name, minutes]) => ({
      name,
      minutes,
      tomatoes: Math.floor(minutes / MIN_PER_TOMATO),
      rest: minutes % MIN_PER_TOMATO,
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
