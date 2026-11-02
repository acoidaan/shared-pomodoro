"use client";

import Link from "next/link";
import TimerPage from "../../page";
import { RoomProvider, useRoom } from "../../room-context";
import { useTimer } from "../../timer-context";

function RoomContent() {
  const roomSession = useRoom();
  const { name, nameLoaded } = useTimer();

  if (nameLoaded && !name.trim()) return <TimerPage />;

  if (roomSession.status === "setup") {
    return (
      <div className="room-gate card">
        <span className="room-gate-mark">01</span>
        <span className="eyebrow">Configuración necesaria</span>
        <h1>La sala está lista para conectarse.</h1>
        <p>
          Falta añadir las credenciales gratuitas de Firebase para activar salas,
          usuarios y sincronización en tiempo real.
        </p>
        <Link href="/" className="btn btn-primary">
          Volver al temporizador
        </Link>
      </div>
    );
  }

  if (roomSession.status === "connecting") {
    return (
      <div className="room-gate card">
        <span className="room-loader" />
        <span className="eyebrow">Conectando</span>
        <h1>Preparando la sala {roomSession.code}…</h1>
        <p>Estamos sincronizando el temporizador y las listas del grupo.</p>
      </div>
    );
  }

  if (["missing", "error"].includes(roomSession.status)) {
    return (
      <div className="room-gate card">
        <span className="room-gate-mark error">!</span>
        <span className="eyebrow">No hemos podido entrar</span>
        <h1>Esta sala no está disponible.</h1>
        <p>{roomSession.error}</p>
        <Link href="/" className="btn btn-primary">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return <TimerPage />;
}

export default function RoomClient({ code }) {
  return (
    <RoomProvider code={code}>
      <RoomContent />
    </RoomProvider>
  );
}
