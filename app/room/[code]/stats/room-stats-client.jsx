"use client";

import Link from "next/link";
import { RoomProvider, useRoom } from "../../../room-context";
import { StatsDashboard } from "../../../stats/page";
import { useTimer } from "../../../timer-context";

function RoomStatsContent() {
  const roomSession = useRoom();
  const { name, nameLoaded } = useTimer();

  if (nameLoaded && !name.trim()) {
    return (
      <div className="room-gate card">
        <span className="room-gate-mark">01</span>
        <span className="eyebrow">Perfil necesario</span>
        <h1>Entra primero en la sala.</h1>
        <p>Necesitamos tu nombre para comprobar que formas parte del grupo.</p>
        <Link href={`/room/${roomSession.code}`} className="btn btn-primary">
          Ir a la sala
        </Link>
      </div>
    );
  }

  if (roomSession.status === "connecting") {
    return (
      <div className="room-gate card">
        <span className="room-loader" />
        <span className="eyebrow">Sincronizando</span>
        <h1>Preparando las estadísticas…</h1>
        <p>Estamos reuniendo el historial compartido de la sala.</p>
      </div>
    );
  }

  if (["setup", "missing", "error"].includes(roomSession.status)) {
    return (
      <div className="room-gate card">
        <span className="room-gate-mark error">!</span>
        <span className="eyebrow">No disponible</span>
        <h1>No podemos abrir estas estadísticas.</h1>
        <p>{roomSession.error || "La sala no está disponible."}</p>
        <Link href="/" className="btn btn-primary">Volver al inicio</Link>
      </div>
    );
  }

  return <StatsDashboard roomCode={roomSession.code} />;
}

export default function RoomStatsClient({ code }) {
  return (
    <RoomProvider code={code}>
      <RoomStatsContent />
    </RoomProvider>
  );
}
