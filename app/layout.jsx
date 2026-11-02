import "./globals.css";
import { TimerProvider } from "./timer-context";
import HeaderTimer from "./header-timer";
import SiteLogo from "./site-logo";
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
              <SiteLogo />
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
