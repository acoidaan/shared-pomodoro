# 🍅 Pomodoro Amigos

Pomodoro online para usar con tus amigos: cada uno entra con el mismo link, pone su
nombre, hace sus pomodoros (o temporizadores normales) y todos podéis ver las
estadísticas del grupo: ranking semanal, tiempo de enfoque y actividad reciente.

**Stack:** Next.js (React) + Supabase (base de datos gratis) + Vercel (hosting gratis).

---

## 1. Probarlo en local (2 minutos)

```bash
cd pomodoro-amigos
npm install
npm run dev
```

Abre http://localhost:3000. Sin configurar nada más ya funciona, pero las sesiones
se guardan solo en tu navegador. Para compartir estadísticas con tus amigos sigue
los pasos 2 y 3.

## 2. Crear la base de datos en Supabase (gratis)

1. Entra en https://supabase.com y crea una cuenta (con GitHub es un click).
2. **New project** → ponle nombre (ej. `pomodoro-amigos`), elige una contraseña
   de base de datos cualquiera y la región más cercana (Europe West). Plan **Free**.
3. Cuando termine de crearse, ve a **SQL Editor** (icono de terminal en el menú
   izquierdo) → pega TODO el contenido del archivo `supabase-schema.sql` → **Run**.
4. Ve a **Project Settings → API** y copia dos valores:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public key** (un token largo)
5. En la carpeta del proyecto, copia `.env.local.example` a `.env.local` y pega
   esos dos valores:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

6. Reinicia `npm run dev`. Ahora las sesiones se guardan en la nube y la página
   de estadísticas muestra a todo el mundo.

> ⚠️ La `anon key` es pública por diseño (va en el navegador), no pasa nada por
> exponerla. Lo que NUNCA debes exponer es la `service_role key`.

## 3. Publicarlo en Vercel (gratis)

### Opción A — con GitHub (recomendada, se actualiza sola)

1. Crea un repo en GitHub y sube el proyecto:

```bash
git init
git add .
git commit -m "Pomodoro Amigos"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/pomodoro-amigos.git
git push -u origin main
```

2. Entra en https://vercel.com → **Add New → Project** → importa el repo.
3. Antes de darle a Deploy, abre **Environment Variables** y añade las dos
   variables (las mismas de tu `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy**. En un minuto tendrás una URL tipo
   `https://pomodoro-amigos.vercel.app` → **ese es el link que pasas a tus amigos**.

Cada vez que hagas `git push`, Vercel redespliega solo.

### Opción B — sin GitHub (CLI)

```bash
npm install -g vercel
vercel login
vercel --prod
```

Te preguntará por el proyecto; acepta los valores por defecto. Luego añade las
variables de entorno con `vercel env add NEXT_PUBLIC_SUPABASE_URL` y
`vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY`, y vuelve a ejecutar `vercel --prod`.

## Cómo funciona

- **Temporizador** (`app/page.jsx`): modo Pomodoro (trabajo/descanso/descanso
  largo cada 4 ciclos, duraciones configurables) o modo temporizador normal.
  El conteo usa timestamps reales, así que no se desincroniza aunque la pestaña
  quede en segundo plano. Suena un aviso y manda notificación al terminar.
- **Estadísticas** (`app/stats/page.jsx`): ranking semanal con barras, totales
  del grupo y feed de actividad reciente. Tu nombre aparece resaltado.
- **Datos** (`lib/sessions.js`): cada sesión completada se inserta en la tabla
  `sessions` de Supabase con nombre, modo, minutos y fecha. Sin Supabase
  configurado, guarda en localStorage como fallback.
- **Identidad**: no hay login; cada uno escribe su nombre una vez y queda
  guardado en su navegador. Suficiente para un grupo de amigos de confianza.
