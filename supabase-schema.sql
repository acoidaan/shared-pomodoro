-- Pomodoro Amigos: esquema de base de datos
-- Pega este archivo entero en Supabase -> SQL Editor -> Run

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null check (mode in ('pomodoro', 'timer')),
  minutes integer not null check (minutes > 0 and minutes <= 600),
  completed_at timestamptz not null default now()
);

-- Seguridad a nivel de fila: cualquiera con la anon key puede leer e insertar,
-- pero nadie puede editar ni borrar sesiones de otros.
alter table public.sessions enable row level security;

create policy "lectura publica" on public.sessions
  for select using (true);

create policy "insercion publica" on public.sessions
  for insert with check (true);

create index sessions_completed_at_idx on public.sessions (completed_at desc);
