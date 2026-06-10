"use client";

import { useEffect, useState } from "react";
import { hasSupabase } from "../lib/supabaseClient";
import { avatarColor } from "../lib/avatar";
import { formatTime, useTimer } from "./timer-context";

function statusFor(friend, now) {
  if (friend.running && friend.endAt) {
    const left = (friend.endAt - now) / 1000;
    if (left <= 0) return { icon: "⏳", label: "Terminando…", left: null };
    if (friend.mode === "timer")
      return { icon: "⏱️", label: "Temporizador", left };
    if (friend.phase === "work")
      return { icon: "🍅", label: "Concentrado", left };
    return { icon: "☕", label: "Descansando", left };
  }
  return { icon: "👀", label: "Conectado", left: null };
}

// Quién tiene la página abierta ahora mismo, vía Supabase Realtime Presence.
export default function FriendsPanel() {
  const { friends, name, joinSession } = useTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!hasSupabase || friends.length === 0) return null;

  const me = name.trim();
  const sorted = [...friends].sort((a, b) => {
    if (a.key === me) return -1;
    if (b.key === me) return 1;
    if (a.running !== b.running) return a.running ? -1 : 1;
    return a.key.localeCompare(b.key);
  });

  return (
    <div className="card friends-panel">
      <h2 className="friends-title">
        👥 En la sala ahora <span className="friends-count">{friends.length}</span>
      </h2>
      <div className="friends-list">
        {sorted.map((f) => {
          const isMe = f.key === me;
          const st = statusFor(f, now);
          const joinable =
            !isMe && f.running && f.endAt && f.endAt - now > 5000;
          return (
            <div className="friend-row" key={f.key}>
              <span
                className="avatar"
                style={{ background: avatarColor(f.key) }}
              >
                {f.key.charAt(0).toUpperCase()}
              </span>
              <span className="friend-name">
                {f.key}
                {isMe && <small> (tú)</small>}
              </span>
              <span
                className={`friend-status ${st.left != null && f.phase === "work" && f.mode === "pomodoro" ? "focusing" : ""}`}
              >
                {st.icon} {st.label}
                {st.left != null && (
                  <strong className="friend-countdown">
                    {formatTime(st.left)}
                  </strong>
                )}
              </span>
              {joinable && (
                <button
                  className="btn join-btn"
                  title="Sincronizar tu temporizador con esta sesión"
                  onClick={() => joinSession(f)}
                >
                  Unirme
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="friends-hint">
        Pulsa «Unirme» para engancharte al reloj de un amigo y terminar a la
        vez.
      </p>
    </div>
  );
}
