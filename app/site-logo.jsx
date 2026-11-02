"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveRoomCode } from "../lib/activeRoom";

export default function SiteLogo() {
  const pathname = usePathname();
  const rememberedRoomCode = useActiveRoomCode();
  const routeRoomCode = pathname.match(/^\/room\/([^/]+)/)?.[1] || "";
  const roomCode = routeRoomCode || rememberedRoomCode;

  return (
    <Link
      href={roomCode ? `/room/${roomCode}` : "/"}
      className="logo"
      aria-label="Shared Pomodoro"
    >
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-leaf" />
      </span>
      <span className="brand-copy">
        <strong>shared</strong>
        <small>pomodoro</small>
      </span>
    </Link>
  );
}
