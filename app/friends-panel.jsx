"use client";

import { useEffect, useState } from "react";
import { avatarColor } from "../lib/avatar";
import { formatTime } from "./timer-context";
import { useRoom } from "./room-context";

function statusFor(member, now) {
  if (member.running && member.endAt) {
    const left = (member.endAt - now) / 1000;
    if (left <= 0) return { label: "Terminando…", left: null, kind: "ending" };
    if (member.mode === "timer") {
      return { label: "Temporizador", left, kind: "timer" };
    }
    if (member.phase === "work") {
      return { label: "En concentración", left, kind: "focus" };
    }
    return { label: "En descanso", left, kind: "break" };
  }
  return { label: "Disponible", left: null, kind: "online" };
}

export default function FriendsPanel() {
  const roomSession = useRoom();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!roomSession || roomSession.members.length === 0) return null;

  const roomTimer = roomSession.room?.timer;
  const myMemberId = roomSession.user?.uid;
  const members = roomSession.members
    .map((member) => ({
      ...member,
      key: member.name,
      memberId: member.uid || member.id,
      mode: roomTimer?.mode,
      phase: roomTimer?.phase,
      running: roomTimer?.running,
      endAt: roomTimer?.endsAt,
    }))
    .sort((a, b) => {
      if (a.memberId === myMemberId) return -1;
      if (b.memberId === myMemberId) return 1;
      return a.key.localeCompare(b.key);
    });

  return (
    <section className="card friends-panel">
      <div className="friends-panel-head">
        <div>
          <span className="eyebrow">Sala en directo</span>
          <h2 className="friends-title">
            Participantes y prioridades
            <span className="friends-count">{members.length}</span>
          </h2>
        </div>
        <div className="room-avatars" aria-hidden="true">
          {members.slice(0, 5).map((member) => (
            <span
              key={member.memberId}
              style={{ background: member.color || avatarColor(member.key) }}
            >
              {member.key.charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <div className="friends-grid">
        {members.map((member) => {
          const isMe = member.memberId === myMemberId;
          const status = statusFor(member, now);
          const sharedTasks = Array.isArray(member.tasks)
            ? member.tasks.slice(0, 12)
            : [];
          const color = member.color || avatarColor(member.key);

          return (
            <article
              className="friend-card"
              key={member.memberId}
              style={{ "--user-color": color }}
            >
              <div className="friend-row">
                <span className="avatar" style={{ background: color }}>
                  {member.key.charAt(0).toUpperCase()}
                </span>
                <span className="friend-name">
                  {member.key}
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
