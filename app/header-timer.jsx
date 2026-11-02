"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveRoomCode } from "../lib/activeRoom";
import { formatTime, useTimer } from "./timer-context";

// Mini contador en la cabecera: visible en cualquier página mientras corre el tiempo.
export default function HeaderTimer() {
  const { running, remaining, mode, phase } = useTimer();
  const pathname = usePathname();
  const rememberedRoomCode = useActiveRoomCode();
  const routeRoomCode = pathname.match(/^\/room\/([^/]+)/)?.[1] || "";
  const roomCode = routeRoomCode || rememberedRoomCode;

  if (!running) return null;

  const isBreak = mode === "pomodoro" && phase !== "work";

  return (
    <Link
      href={roomCode ? `/room/${roomCode}` : "/"}
      className={`header-timer ${isBreak ? "is-break" : ""}`}
      title="Volver al temporizador"
    >
      <span className="pulse-dot" />
      {formatTime(remaining)}
      <span className="header-timer-label">
        {mode === "timer" ? "⏱️" : isBreak ? "☕" : "🍅"}
      </span>
    </Link>
  );
}
