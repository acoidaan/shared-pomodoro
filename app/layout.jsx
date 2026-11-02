import "./globals.css";
import Link from "next/link";
import { TimerProvider } from "./timer-context";
import HeaderTimer from "./header-timer";
import SiteNav from "./site-nav";

export const metadata = {
  title: "Shared Pomodoro — enfócate en compañía",
  description:
    "Sesiones de concentración compartidas para avanzar junto a tus amigos.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <TimerProvider>
          <header className="site-header">
            <div className="header-inner">
              <Link href="/" className="logo" aria-label="Shared Pomodoro">
                <span className="brand-mark" aria-hidden="true">
                  <span className="brand-leaf" />
                </span>
                <span className="brand-copy">
                  <strong>shared</strong>
                  <small>pomodoro</small>
                </span>
              </Link>
              <SiteNav />
              <div className="header-status">
                <HeaderTimer />
                <span className="status-indicator">
                  <span /> En línea
                </span>
              </div>
            </div>
          </header>
          <main className="container">{children}</main>
        </TimerProvider>
      </body>
    </html>
  );
}
