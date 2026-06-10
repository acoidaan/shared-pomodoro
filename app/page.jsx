"use client";

import { useState } from "react";
import { hasSupabase } from "../lib/supabaseClient";
import { avatarColor } from "../lib/avatar";
import FriendsPanel from "./friends-panel";
import {
  CYCLES_BEFORE_LONG_BREAK,
  formatTime,
  useTimer,
} from "./timer-context";

const TIMER_PRESETS = [10, 15, 25, 30, 45, 60, 90];

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
  const {
    name,
    nameLoaded,
    setName,
    mode,
    workMin,
    setWorkMin,
    breakMin,
    setBreakMin,
    longBreakMin,
    setLongBreakMin,
    timerMin,
    setTimerMin,
    phase,
    running,
    remaining,
    total,
    completedPomodoros,
    saveError,
    start,
    pause,
    reset,
    skipPhase,
    switchMode,
  } = useTimer();

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");

  const saveName = () => {
    const clean = draftName.trim();
    if (!clean) return;
    setName(clean);
    setEditingName(false);
  };

  // Anillo de progreso
  const R = 125;
  const C = 2 * Math.PI * R;
  const progress = total > 0 ? remaining / total : 0;
  const isBreak = mode === "pomodoro" && phase !== "work";
  const ringColor = isBreak ? "var(--green)" : "var(--accent)";

  const showWelcome = nameLoaded && (!name.trim() || editingName);

  return (
    <div>
      {showWelcome && (
        <div className="overlay">
          <div className="welcome-card">
            <div className="welcome-emoji">🍅</div>
            <h2>{name.trim() ? "Cambiar nombre" : "¡Bienvenido!"}</h2>
            <p>
              {name.trim()
                ? "Tus próximas sesiones se guardarán con el nuevo nombre."
                : "Dinos cómo te llamas para guardar tus pomodoros y salir en el ranking con tus amigos."}
            </p>
            <input
              autoFocus
              type="text"
              placeholder="Tu nombre"
              maxLength={30}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
            />
            <div className="welcome-actions">
              <button
                className="btn btn-primary"
                disabled={!draftName.trim()}
                onClick={saveName}
              >
                {name.trim() ? "Guardar" : "¡A concentrarse!"}
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
          ℹ️ Supabase no está configurado: las sesiones se guardan solo en este
          navegador. Sigue los pasos del README para tener estadísticas
          compartidas con tus amigos.
        </div>
      )}

      <div className="top-row">
        <div className="mode-switch">
          <button
            className={mode === "pomodoro" ? "active" : ""}
            onClick={() => switchMode("pomodoro")}
          >
            🍅 Pomodoro
          </button>
          <button
            className={mode === "timer" ? "active" : ""}
            onClick={() => switchMode("timer")}
          >
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
        {mode === "pomodoro" && (
          <span
            className={`phase-label ${isBreak ? "phase-break" : "phase-work"}`}
          >
            {phase === "work"
              ? "Concentración"
              : phase === "longBreak"
                ? "Descanso largo"
                : "Descanso"}
          </span>
        )}

        <div className="ring-wrap">
          <svg width="280" height="280" viewBox="0 0 280 280">
            <circle
              className="ring-bg"
              cx="140"
              cy="140"
              r={R}
              fill="none"
              strokeWidth="10"
            />
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
            {mode === "pomodoro" && (
              <span className="sub">
                {completedPomodoros} pomodoro
                {completedPomodoros === 1 ? "" : "s"} hoy
              </span>
            )}
          </div>
        </div>

        <div className="controls">
          {!running ? (
            <button
              className="btn btn-primary"
              onClick={start}
              disabled={!name.trim()}
            >
              {remaining < total ? "Continuar" : "Empezar"}
            </button>
          ) : (
            <button className="btn" onClick={pause}>
              Pausar
            </button>
          )}
          <button className="btn" onClick={reset}>
            Reiniciar
          </button>
          {mode === "pomodoro" && isBreak && (
            <button className="btn" onClick={skipPhase}>
              Saltar descanso
            </button>
          )}
        </div>

        {saveError && <p className="cycles-info">⚠️ {saveError}</p>}

        {!running && (
          <>
            {mode === "timer" && (
              <div className="preset-chips">
                {TIMER_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`chip ${timerMin === p ? "active" : ""}`}
                    onClick={() => setTimerMin(p)}
                  >
                    {p} min
                  </button>
                ))}
              </div>
            )}

            <div className="settings">
              {mode === "pomodoro" ? (
                <>
                  <Stepper
                    label="Trabajo"
                    value={workMin}
                    onChange={setWorkMin}
                    step={5}
                    min={5}
                  />
                  <Stepper
                    label="Descanso"
                    value={breakMin}
                    onChange={setBreakMin}
                    step={1}
                  />
                  <Stepper
                    label="Descanso largo"
                    value={longBreakMin}
                    onChange={setLongBreakMin}
                    step={5}
                    min={5}
                  />
                </>
              ) : (
                <Stepper
                  label="Personalizado"
                  value={timerMin}
                  onChange={setTimerMin}
                  step={5}
                  min={5}
                />
              )}
            </div>
          </>
        )}

        {mode === "pomodoro" && (
          <p className="cycles-info">
            Cada {CYCLES_BEFORE_LONG_BREAK} pomodoros toca un descanso largo.
          </p>
        )}
      </div>

      <FriendsPanel />
    </div>
  );
}
