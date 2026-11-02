"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { hasFirebase } from "../lib/firebaseClient";
import { createRoom, joinRoom, normalizeRoomCode } from "../lib/rooms";
import { useRoom } from "./room-context";
import { useTimer } from "./timer-context";

function timerSnapshot(timer) {
  return {
    mode: timer.mode,
    phase: timer.phase,
    running: timer.running,
    endsAt: timer.running ? Date.now() + timer.remaining * 1000 : null,
    remaining: timer.remaining,
    total: timer.total,
    workMin: timer.workMin,
    breakMin: timer.breakMin,
    longBreakMin: timer.longBreakMin,
    timerMin: timer.timerMin,
    cycles: timer.cycles,
    planPos: timer.planPos,
    planDone: timer.planDone,
  };
}

export function RoomLauncher() {
  const timer = useTimer();
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const create = async () => {
    if (!timer.name.trim()) return;
    setBusy("create");
    setError("");
    try {
      const code = await createRoom({
        name: timer.name,
        tasks: timer.tasks,
        timer: timerSnapshot(timer),
      });
      router.push(`/room/${code}`);
    } catch (createError) {
      setError(createError.message || "No se pudo crear la sala.");
      setBusy("");
    }
  };

  const join = async (event) => {
    event.preventDefault();
    const code = normalizeRoomCode(roomCode);
    if (!code || !timer.name.trim()) return;
    setBusy("join");
    setError("");
    try {
      await joinRoom({
        code,
        name: timer.name,
        tasks: timer.tasks,
      });
      router.push(`/room/${code}`);
    } catch (joinError) {
      setError(joinError.message || "No se pudo entrar en la sala.");
      setBusy("");
    }
  };

  return (
    <section className="room-launcher">
      <div className="room-launcher-copy">
        <span className="room-launcher-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <div>
          <span className="eyebrow">En compañía</span>
          <h2>Crea una sala de enfoque</h2>
          <p>Comparte el reloj, las tareas y el progreso mediante un enlace privado.</p>
        </div>
      </div>

      {hasFirebase ? (
        <div className="room-launcher-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={Boolean(busy) || !timer.name.trim()}
            onClick={create}
          >
            {busy === "create" ? "Creando…" : "Crear sala"}
          </button>
          <span className="room-action-divider">o</span>
          <form onSubmit={join}>
            <input
              value={roomCode}
              maxLength={8}
              placeholder="Código"
              aria-label="Código de sala"
              onChange={(event) => setRoomCode(normalizeRoomCode(event.target.value))}
            />
            <button
              type="submit"
              className="btn"
              disabled={Boolean(busy) || roomCode.length < 4 || !timer.name.trim()}
            >
              {busy === "join" ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      ) : (
        <div className="room-setup-state">
          <span>Backend pendiente</span>
          <p>La interfaz está preparada; falta conectar el proyecto gratuito de Firebase.</p>
        </div>
      )}

      {error && <p className="room-launcher-error">{error}</p>}
    </section>
  );
}

export function RoomToolbar() {
  const roomSession = useRoom();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  if (!roomSession || roomSession.status !== "ready") return null;

  const copy = async () => {
    try {
      await roomSession.copyInvite();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const leave = async () => {
    setLeaving(true);
    try {
      await roomSession.leaveRoom();
    } finally {
      router.push("/");
    }
  };

  const close = async () => {
    if (!confirmClose) {
      setConfirmClose(true);
      window.setTimeout(() => setConfirmClose(false), 4000);
      return;
    }

    setClosing(true);
    try {
      await roomSession.closeRoom();
      router.push("/");
    } finally {
      setClosing(false);
    }
  };

  return (
    <section className="room-toolbar">
      <div className="room-identity">
        <span className="room-live-dot" />
        <div>
          <span>Sala compartida</span>
          <strong>{roomSession.room?.title || `Sala ${roomSession.code}`}</strong>
        </div>
      </div>
      <div className="room-toolbar-meta">
        <span className="room-role">
          {roomSession.isHost ? "Creador" : "Participante"} · control compartido
        </span>
        <span className="room-code">{roomSession.code}</span>
        <span className="room-member-count">
          {roomSession.members.length} {roomSession.members.length === 1 ? "persona" : "personas"}
        </span>
      </div>
      <div className="room-toolbar-actions">
        <Link href={`/room/${roomSession.code}/stats`} className="btn btn-ghost">
          Estadísticas
        </Link>
        <Link
          href={`/overlay/${roomSession.code}`}
          target="_blank"
          className="btn btn-ghost"
        >
          Overlay OBS
        </Link>
        <button type="button" className="btn" onClick={copy}>
          {copied ? "Enlace copiado" : "Copiar invitación"}
        </button>
        {roomSession.isHost && (
          <button
            type="button"
            className={`btn btn-ghost room-close-btn ${confirmClose ? "confirm" : ""}`}
            disabled={closing}
            onClick={close}
          >
            {closing
              ? "Cerrando…"
              : confirmClose
                ? "Confirmar cierre"
                : "Cerrar sala"}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={leaving}
          onClick={leave}
        >
          {leaving ? "Saliendo…" : "Salir"}
        </button>
      </div>
    </section>
  );
}
