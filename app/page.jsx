'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { hasSupabase } from '../lib/supabaseClient';
import { saveSession } from '../lib/sessions';

const CYCLES_BEFORE_LONG_BREAK = 4;
const TIMER_PRESETS = [10, 15, 25, 30, 45, 60, 90];

const AVATAR_COLORS = ['#ff6347', '#f59e0b', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#2dd4bf'];

function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = i === 2 ? 880 : 660;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.22);
    });
  } catch {
    // sin sonido si el navegador lo bloquea
  }
}

function notify(message) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    new Notification('🍅 Pomodoro Amigos', { body: message });
  }
}

function Stepper({ label, value, onChange, step = 5, min = 1, max = 180 }) {
  return (
    <div className="stepper-card">
      <span className="stepper-label">{label}</span>
      <div className="stepper">
        <button
          type="button"
          aria-label={`Restar ${step} minutos a ${label}`}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          −
        </button>
        <span className="stepper-value">
          {value}
          <small>min</small>
        </span>
        <button
          type="button"
          aria-label={`Sumar ${step} minutos a ${label}`}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function TimerPage() {
  const [name, setName] = useState('');
  const [nameLoaded, setNameLoaded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const [mode, setMode] = useState('pomodoro'); // 'pomodoro' | 'timer'

  // Ajustes (en minutos)
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [timerMin, setTimerMin] = useState(30);

  // Estado del temporizador
  const [phase, setPhase] = useState('work'); // 'work' | 'break' | 'longBreak' (solo pomodoro)
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60); // segundos
  const [total, setTotal] = useState(25 * 60);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [saveError, setSaveError] = useState('');

  const endAtRef = useRef(null);
  const intervalRef = useRef(null);

  // Cargar nombre guardado
  useEffect(() => {
    setName(localStorage.getItem('pomodoro-amigos-name') || '');
    setNameLoaded(true);
  }, []);

  const saveName = () => {
    const clean = draftName.trim();
    if (!clean) return;
    setName(clean);
    localStorage.setItem('pomodoro-amigos-name', clean);
    setEditingName(false);
  };

  const durationForPhase = useCallback(
    (ph) => {
      if (mode === 'timer') return timerMin * 60;
      if (ph === 'work') return workMin * 60;
      if (ph === 'longBreak') return longBreakMin * 60;
      return breakMin * 60;
    },
    [mode, timerMin, workMin, breakMin, longBreakMin]
  );

  // Si cambian los ajustes de duración con el temporizador parado, actualizar la cuenta.
  // Ojo: `running` NO está en las dependencias a propósito — pausar no debe resetear el tiempo.
  useEffect(() => {
    if (running) return;
    const d = durationForPhase(phase);
    setRemaining(d);
    setTotal(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationForPhase, phase]);

  // Título de la pestaña
  useEffect(() => {
    if (running) {
      const label = mode === 'timer' ? 'Timer' : phase === 'work' ? 'Focus' : 'Descanso';
      document.title = `${formatTime(remaining)} · ${label}`;
    } else {
      document.title = 'Pomodoro Amigos';
    }
  }, [remaining, running, mode, phase]);

  const handleComplete = useCallback(() => {
    setRunning(false);
    playBeep();

    if (mode === 'timer') {
      notify('¡Tiempo completado!');
      setSaveError('');
      saveSession({ name: name.trim(), mode: 'timer', minutes: timerMin }).catch(() =>
        setSaveError('No se pudo guardar la sesión. Revisa tu conexión o la configuración de Supabase.')
      );
      const d = timerMin * 60;
      setRemaining(d);
      setTotal(d);
      return;
    }

    if (phase === 'work') {
      const done = completedPomodoros + 1;
      setCompletedPomodoros(done);
      setSaveError('');
      saveSession({ name: name.trim(), mode: 'pomodoro', minutes: workMin }).catch(() =>
        setSaveError('No se pudo guardar la sesión. Revisa tu conexión o la configuración de Supabase.')
      );
      const nextPhase = done % CYCLES_BEFORE_LONG_BREAK === 0 ? 'longBreak' : 'break';
      notify(nextPhase === 'longBreak' ? '¡Pomodoro completado! Descanso largo 🎉' : '¡Pomodoro completado! Toca descansar.');
      setPhase(nextPhase);
      // Los descansos empiezan solos
      const d = nextPhase === 'longBreak' ? longBreakMin * 60 : breakMin * 60;
      setRemaining(d);
      setTotal(d);
      endAtRef.current = Date.now() + d * 1000;
      setRunning(true);
    } else {
      notify('Descanso terminado. ¡A por el siguiente pomodoro!');
      setPhase('work');
      const d = workMin * 60;
      setRemaining(d);
      setTotal(d);
      // El trabajo empieza cuando tú le des, sin prisa
    }
  }, [mode, phase, name, timerMin, workMin, breakMin, longBreakMin, completedPomodoros]);

  // Bucle del temporizador basado en timestamps (no se desincroniza si la pestaña se duerme)
  useEffect(() => {
    if (!running) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const left = (endAtRef.current - Date.now()) / 1000;
      if (left <= 0) {
        clearInterval(intervalRef.current);
        setRemaining(0);
        handleComplete();
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(intervalRef.current);
  }, [running, handleComplete]);

  const start = () => {
    if (!name.trim()) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    endAtRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  };

  const pause = () => {
    setRunning(false);
  };

  const reset = () => {
    setRunning(false);
    setPhase('work');
    const d = mode === 'timer' ? timerMin * 60 : workMin * 60;
    setRemaining(d);
    setTotal(d);
  };

  const skipPhase = () => {
    if (mode !== 'pomodoro' || phase === 'work') return;
    setRunning(false);
    setPhase('work');
    const d = workMin * 60;
    setRemaining(d);
    setTotal(d);
  };

  const switchMode = (m) => {
    if (m === mode) return;
    setRunning(false);
    setMode(m);
    setPhase('work');
    const d = m === 'timer' ? timerMin * 60 : workMin * 60;
    setRemaining(d);
    setTotal(d);
  };

  // Anillo de progreso
  const R = 125;
  const C = 2 * Math.PI * R;
  const progress = total > 0 ? remaining / total : 0;
  const isBreak = mode === 'pomodoro' && phase !== 'work';
  const ringColor = isBreak ? 'var(--green)' : 'var(--accent)';

  const showWelcome = nameLoaded && (!name.trim() || editingName);

  return (
    <div>
      {showWelcome && (
        <div className="overlay">
          <div className="welcome-card">
            <div className="welcome-emoji">🍅</div>
            <h2>{name.trim() ? 'Cambiar nombre' : '¡Bienvenido!'}</h2>
            <p>
              {name.trim()
                ? 'Tus próximas sesiones se guardarán con el nuevo nombre.'
                : 'Dinos cómo te llamas para guardar tus pomodoros y salir en el ranking con tus amigos.'}
            </p>
            <input
              autoFocus
              type="text"
              placeholder="Tu nombre"
              maxLength={30}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
            />
            <div className="welcome-actions">
              <button className="btn btn-primary" disabled={!draftName.trim()} onClick={saveName}>
                {name.trim() ? 'Guardar' : '¡A concentrarse!'}
              </button>
              {name.trim() && (
                <button className="btn" onClick={() => setEditingName(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasSupabase && (
        <div className="banner">
          ℹ️ Supabase no está configurado: las sesiones se guardan solo en este navegador.
          Sigue los pasos del README para tener estadísticas compartidas con tus amigos.
        </div>
      )}

      <div className="top-row">
        <div className="mode-switch">
          <button className={mode === 'pomodoro' ? 'active' : ''} onClick={() => switchMode('pomodoro')}>
            🍅 Pomodoro
          </button>
          <button className={mode === 'timer' ? 'active' : ''} onClick={() => switchMode('timer')}>
            ⏱️ Temporizador
          </button>
        </div>

        {name.trim() && (
          <button
            className="profile-chip"
            title="Cambiar nombre"
            onClick={() => {
              setDraftName(name);
              setEditingName(true);
            }}
          >
            <span className="avatar" style={{ background: avatarColor(name) }}>
              {name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="profile-name">{name}</span>
            <span className="edit-icon">✎</span>
          </button>
        )}
      </div>

      <div className="card timer-card">
        {mode === 'pomodoro' && (
          <span className={`phase-label ${isBreak ? 'phase-break' : 'phase-work'}`}>
            {phase === 'work' ? 'Concentración' : phase === 'longBreak' ? 'Descanso largo' : 'Descanso'}
          </span>
        )}

        <div className="ring-wrap">
          <svg width="280" height="280" viewBox="0 0 280 280">
            <circle className="ring-bg" cx="140" cy="140" r={R} fill="none" strokeWidth="10" />
            <circle
              className="ring-fg"
              cx="140"
              cy="140"
              r={R}
              fill="none"
              strokeWidth="10"
              stroke={ringColor}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
            />
          </svg>
          <div className="ring-time">
            <span className="digits">{formatTime(remaining)}</span>
            {mode === 'pomodoro' && (
              <span className="sub">
                {completedPomodoros} pomodoro{completedPomodoros === 1 ? '' : 's'} hoy
              </span>
            )}
          </div>
        </div>

        <div className="controls">
          {!running ? (
            <button className="btn btn-primary" onClick={start} disabled={!name.trim()}>
              {remaining < total ? 'Continuar' : 'Empezar'}
            </button>
          ) : (
            <button className="btn" onClick={pause}>
              Pausar
            </button>
          )}
          <button className="btn" onClick={reset}>
            Reiniciar
          </button>
          {mode === 'pomodoro' && isBreak && (
            <button className="btn" onClick={skipPhase}>
              Saltar descanso
            </button>
          )}
        </div>

        {saveError && <p className="cycles-info">⚠️ {saveError}</p>}

        {!running && (
          <>
            {mode === 'timer' && (
              <div className="preset-chips">
                {TIMER_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`chip ${timerMin === p ? 'active' : ''}`}
                    onClick={() => setTimerMin(p)}
                  >
                    {p} min
                  </button>
                ))}
              </div>
            )}

            <div className="settings">
              {mode === 'pomodoro' ? (
                <>
                  <Stepper label="Trabajo" value={workMin} onChange={setWorkMin} step={5} min={5} />
                  <Stepper label="Descanso" value={breakMin} onChange={setBreakMin} step={1} />
                  <Stepper label="Descanso largo" value={longBreakMin} onChange={setLongBreakMin} step={5} min={5} />
                </>
              ) : (
                <Stepper label="Personalizado" value={timerMin} onChange={setTimerMin} step={5} min={5} />
              )}
            </div>
          </>
        )}

        {mode === 'pomodoro' && (
          <p className="cycles-info">Cada {CYCLES_BEFORE_LONG_BREAK} pomodoros toca un descanso largo.</p>
        )}
      </div>
    </div>
  );
}
