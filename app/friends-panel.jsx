"use client";

import { useEffect, useState } from "react";
import { hasSupabase } from "../lib/supabaseClient";
import { avatarColor } from "../lib/avatar";
import { formatTime, useTimer } from "./timer-context";
import { useRoom } from "./room-context";

function statusFor(friend, now) {
  if (friend.running && friend.endAt) {
    const left = (friend.endAt - now) / 1000;
    if (left <= 0) return { label: "Terminando…", left: null, kind: "ending" };
    if (friend.mode === "timer") {
      return { label: "Temporizador", left, kind: "timer" };
    }
    if (friend.phase === "work") {
      return { label: "En concentración", left, kind: "focus" };
    }
    return { label: "En descanso", left, kind: "break" };
  }
  return { label: "Disponible", left: null, kind: "online" };
}

export default function FriendsPanel() {
  const { friends, name, joinSession } = useTimer();
  const roomSession = useRoom();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const roomTimer = roomSession?.room?.timer;
  const visibleFriends = roomSession
    ? roomSession.members.map((member) => ({
        ...member,
        key: member.name,
        memberId: member.uid || member.id,
        mode: roomTimer?.mode,
        phase: roomTimer?.phase,
        running: roomTimer?.running,
        endAt: roomTimer?.endsAt,
        total: roomTimer?.total,
      }))
    : friends;

  if ((!roomSession && !hasSupabase) || visibleFriends.length === 0) return null;

  const me = name.trim();
  const myMemberId = roomSession?.user?.uid;
  const sorted = [...visibleFriends].sort((a, b) => {
    if (roomSession && a.memberId === myMemberId) return -1;
    if (roomSession && b.memberId === myMemberId) return 1;
    if (!roomSession && a.key === me) return -1;
    if (!roomSession && b.key === me) return 1;
    if (a.running !== b.running) return a.running ? -1 : 1;
    return a.key.localeCompare(b.key);
  });

  return (
    <section className="card friends-panel">
      <div className="friends-panel-head">
        <div>
          <span className="eyebrow">Sala en directo</span>
          <h2 className="friends-title">
            {roomSession ? "Participantes y prioridades" : "Personas conectadas"}
            <span className="friends-count">{visibleFriends.length}</span>
          </h2>
        </div>
        <div className="room-avatars" aria-hidden="true">
          {sorted.slice(0, 5).map((friend) => (
            <span
              key={friend.memberId || friend.key}
              style={{ background: friend.color || avatarColor(friend.key) }}
            >
              {friend.key.charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="friends-grid">
        {sorted.map((friend) => {
          const isMe = roomSession
            ? friend.memberId === myMemberId
            : friend.key === me;
          const status = statusFor(friend, now);
          const joinable =
            !roomSession &&
            !isMe &&
            friend.running &&
            friend.endAt &&
            friend.endAt - now > 5000;
          const sharedTasks = Array.isArray(friend.tasks)
            ? friend.tasks.slice(0, 12)
            : [];
          const color = friend.color || avatarColor(friend.key);

          return (
            <article
              className="friend-card"
              key={friend.memberId || friend.key}
              style={{ "--user-color": color }}
            >
              <div className="friend-row">
                <span className="avatar" style={{ background: color }}>
                  {friend.key.charAt(0).toUpperCase()}
                </span>
                <span className="friend-name">
                  {friend.key}
                  {isMe && <small>Tú</small>}
                </span>
                <span className={`friend-status ${status.kind}`}>
                  <span className="friend-status-dot" />
                  {status.label}
                  {status.left != null && (
                    <strong className="friend-countdown">
                      {formatTime(status.left)}
                    </strong>
                  )}
                </span>
                {joinable && (
                  <button
                    className="btn join-btn"
                    title={`Unirte a la sesión de ${friend.key}`}
                    onClick={() => joinSession(friend)}
                  >
                    Unirme
                  </button>
                )}
              </div>

              <div className="shared-focus-list">
                <span className="shared-focus-title">Lista de enfoque</span>
                {sharedTasks.length > 0 ? (
                  <ul>
                    {sharedTasks.map((task) => (
                      <li key={task.id} className={task.done ? "done" : ""}>
                        <span>{task.done ? "✓" : ""}</span>
                        {task.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Aún no ha compartido ninguna tarea.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
