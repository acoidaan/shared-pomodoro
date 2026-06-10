import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "shared pomodoro",
  description: "Pomodoro compartido con estadísticas para ti y tus amigos",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <Link href="/" className="logo">
            🍅 <span>shared pomodoro</span>
          </Link>
          <nav>
            <Link href="/">Temporizador</Link>
            <Link href="/stats">Estadísticas</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
