"use client";

import { useEffect, useMemo, useState } from "react";
import { avatarColor } from "../../../lib/avatar";
import { ensureAnonymousUser, subscribeToMembers, subscribeToRoom } from "../../../lib/rooms";
import { formatTime } from "../../timer-context";

function phaseLabel(timer) {
  if (!timer) return "Preparando sesión";
  if (timer.mode === "timer") return "Temporizador";
  if (timer.phase === "work") return "En concentración";
  if (timer.phase === "longBreak") return "Descanso largo";
  return "Descanso corto";
}

function memberLastSeen(member) {
  if (typeof member.lastSeenAt === "number") return member.lastSeenAt;
  return member.lastSeenAt?.toMillis?.() || member.joinedAt?.toMillis?.() || 0;
}

export default function ObsOverlay({ code }) {
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    document.documentElement.classList.add("obs-overlay-page");
    document.body.classList.add("obs-overlay-route");
    return () => {
      document.documentElement.classList.remove("obs-overlay-page");
      document.body.classList.remove("obs-overlay-route");
    };
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribeRoom = () => {};
    let unsubscribeMembers = () => {};

    ensureAnonymousUser()
      .then(() => {
        if (!active) return;
        unsubscribeRoom = subscribeToRoom(
          code,
          (nextRoom) => {
            if (!active) return;
            setRoom(nextRoom);
            setStatus(nextRoom ? "ready" : "missing");
          },
          () => active && setStatus("error"),
        );
        unsubscribeMembers = subscribeToMembers(
          code,
          (nextMembers) => active && setMembers(nextMembers),
          () => active && setStatus("error"),
        );
      })
      .catch(() => active && setStatus("error"));

    return () => {
      active = false;
      unsubscribeRoom();
      unsubscribeMembers();
    };
  }, [code]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, []);

  const activeMembers = useMemo(
    () =>
      members
        .filter((member) => {
          const lastSeen = memberLastSeen(member);
          return lastSeen > 0 && now - lastSeen < 25000;
        })
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [members, now],
  );

  const timer = room?.timer;
  const remaining = timer?.running && timer?.endsAt
    ? Math.max(0, (Number(timer.endsAt) - now) / 1000)
    : Math.max(0, Number(timer?.remaining) || Number(timer?.total) || 0);
  const total = Math.max(1, Number(timer?.total) || remaining || 1);
  const progress = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));
  const isBreak = timer?.mode === "pomodoro" && timer?.phase !== "work";

  if (status === "connecting") {
    return <div className="obs-status">Conectando con la sala…</div>;
  }

  if (status !== "ready") {
    return <div className="obs-status error">Sala no disponible</div>;
  }

  return (
    <main className={`obs-card ${isBreak ? "is-break" : ""}`}>
      <section className="obs-timer">
        <div className="obs-room-line">
          <span className={`obs-live ${timer?.running ? "running" : ""}`} />
          <span>{room.title || `Sala ${code}`}</span>
        </div>
        <span className="obs-phase">{phaseLabel(timer)}</span>
        <strong className="obs-time">{formatTime(remaining)}</strong>
        <span className="obs-state">
          {timer?.running ? "Sesión en curso" : "Esperando al anfitrión"}
        </span>
      </section>

      <section className="obs-priorities">
        <div className="obs-priorities-head">
          <span>Prioridades de la sala</span>
          <strong>{activeMembers.length}</strong>
        </div>
        <div className="obs-members">
          {activeMembers.length === 0 && (
            <p className="obs-empty">Esperando participantes…</p>
          )}
          {activeMembers.slice(0, 4).map((member) => {
            const tasks = Array.isArray(member.tasks)
              ? member.tasks.filter((task) => !task.done).slice(0, 2)
              : [];
            const color = member.color || avatarColor(member.name);
            return (
              <div className="obs-member" key={member.uid || member.id}>
                <span className="obs-avatar" style={{ background: color }}>
                  {(member.name || "?").charAt(0).toUpperCase()}
                </span>
                <div>
                  <strong>{member.name || "Invitado"}</strong>
                  {tasks.length > 0 ? (
                    <ul>
                      {tasks.map((task) => <li key={task.id}>{task.text}</li>)}
                    </ul>
                  ) : (
                    <small>Sin tareas pendientes</small>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="obs-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </main>
  );
}
