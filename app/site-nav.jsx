"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActiveRoomCode } from "../lib/activeRoom";

export default function SiteNav() {
  const pathname = usePathname();
  const rememberedRoomCode = useActiveRoomCode();
  const routeRoomCode = pathname.match(/^\/room\/([^/]+)/)?.[1] || "";
  const roomCode = routeRoomCode || rememberedRoomCode;
  const timerHref = roomCode ? `/room/${roomCode}` : "/";
  const statsHref = roomCode ? `/room/${roomCode}/stats` : "/stats";
  const links = [
    { href: timerHref, label: "Temporizador", active: pathname === timerHref },
    { href: "/huerto", label: "Huerto", active: pathname.startsWith("/huerto") },
    {
      href: statsHref,
      label: "Estadísticas",
      active: pathname.startsWith(statsHref),
    },
  ];

  return (
    <nav className="site-nav" aria-label="Navegación principal">
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className={link.active ? "active" : ""}
          aria-current={link.active ? "page" : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
