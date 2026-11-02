"use client";

import { useEffect, useReducer, useState } from "react";
import { hasSupabase } from "../lib/supabaseClient";
import { avatarColor } from "../lib/avatar";
import FriendsPanel from "./friends-panel";
import FocusTasks from "./focus-tasks";
import {
  CYCLES_BEFORE_LONG_BREAK,
  formatTime,
  useTimer,
} from "./timer-context";

const TIMER_PRESETS = [10, 15, 25, 30, 45, 60, 90];

function Stepper({
  label,
  value,
  onChange,
  step = 5,
  min = 1,
  max = 180,
  unit = "min",
}) {
  return (
    <div className="stepper-card">
      <span className="stepper-label">{label}</span>
      <div className="stepper">
        <button
          type="button"
          aria-label={`Restar ${step} a ${label}`}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          −
        </button>
        <span className="stepper-value">
          {value}
          <small>{unit}</small>
        </span>
        <button
          type="button"
          aria-label={`Sumar ${step} a ${label}`}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5h4v14H7V5Zm6 0h4v14h-4V5Z" fill="currentColor" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 5a7 7 0 1 1-6.32 4H8L4.5 5.5 1 9h2.62A9 9 0 1 0 5 4.86V2.5A11 11 0 1 1 12 23 11 11 0 0 1 2.1 7H0l4.5-4.5L9 7H6.78A7 7 0 0 1 12 5Z"
        fill="currentColor"
      />
    </svg>
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
    cycles,
    setCycles,
    phase,
    running,
    remaining,
    total,
    completedPomodoros,
    planPos,
    planDone,
    totalPlanPomodoros,
    planRemainingSeconds,
    saveError,
    start,
    pause,
    reset,
    skipPhase,
    switchMode,
  } = useTimer();

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");

  const [, refreshEstimate] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    if (running) return;
    const id = setInterval(refreshEstimate, 30000);
    return () => clearInterval(id);
  }, [running]);

  const finishAt = new Date(
    Date.now() + planRemainingSeconds * 1000,
  ).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const currentPom = Math.min(
    planPos + (phase === "work" ? 1 : 0),
    totalPlanPomodoros,
  );

  const saveName = () => {
    const clean = draftName.trim();
    if (!clean) return;
    setName(clean);
    setEditingName(false);
  };

  const R = 125;
  const C = 2 * Math.PI * R;
  const progress = total > 0 ? remaining / total : 0;
  const isBreak = mode === "pomodoro" && phase !== "work";
  const ringColor = isBreak ? "var(--green)" : "var(--accent)";
  const showWelcome = nameLoaded && (!name.trim() || editingName);
  const phaseName =
    mode === "timer"
      ? "Temporizador"
      : phase === "work"
        ? "Concentración"
        : phase === "longBreak"
          ? "Descanso largo"
          : "Descanso corto";

  return (
    <div className="timer-page">
      {showWelcome && (
        <div className="overlay">
          <div className="welcome-card">
            <span className="welcome-brand brand-mark" aria-hidden="true">
              <span className="brand-leaf" />
            </span>
            <div className="welcome-heading">
              <span className="eyebrow">Tu espacio de enfoque</span>
              <h2>{name.trim() ? "Actualiza tu perfil" : "Empecemos por tu nombre"}</h2>
              <p>
                {name.trim()
                  ? "Este será el nombre que verán los demás en tus próximas sesiones."
                  : "Lo usaremos para guardar tu progreso y reconocerte cuando trabajes con otras personas."}
              </p>
            </div>
            <label className="input-label" htmlFor="profile-name">
              Nombre visible
            </label>
            <input
              id="profile-name"
              autoFocus
              type="text"
              placeholder="¿Cómo te llamas?"
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
                {name.trim() ? "Guardar cambios" : "Continuar"}
              </button>
              {name.trim() && (
                <button className="btn btn-ghost" onClick={() => setEditingName(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="dashboard-heading">
        <div>
          <span className="eyebrow">Panel de concentración</span>
          <h1>Tu próxima sesión empieza aquí.</h1>
          <p>
            Define tu ritmo, elimina distracciones y avanza en lo que importa.
          </p>
        </div>

        {name.trim() && (
          <button
            className="profile-chip"
            title="Editar perfil"
            onClick={() => {
              setDraftName(name);
              setEditingName(true);
            }}
          >
            <span className="avatar" style={{ background: avatarColor(name) }}>
              {name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="profile-text">
              <small>Trabajando como</small>
              <strong>{name}</strong>
            </span>
            <span className="edit-icon">Editar</span>
          </button>
        )}
      </section>

      {!hasSupabase && (
        <div className="local-notice">
          <span className="local-notice-icon" aria-hidden="true">i</span>
          <div>
            <strong>Estás en modo local</strong>
            <span>Tu progreso se guarda únicamente en este dispositivo.</span>
          </div>
          <span className="local-notice-tag">Privado</span>
        </div>
      )}

      <div className="quick-stats" aria-label="Resumen de la sesión">
        <div className="quick-stat">
          <span className="quick-stat-icon accent">01</span>
          <div>
            <strong>{completedPomodoros}</strong>
            <span>Completados hoy</span>
          </div>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-icon violet">02</span>
          <div>
            <strong>{mode === "pomodoro" ? `${workMin} min` : `${timerMin} min`}</strong>
            <span>Duración actual</span>
          </div>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-icon green">03</span>
          <div>
            <strong>{mode === "pomodoro" ? totalPlanPomodoros : "Libre"}</strong>
            <span>{mode === "pomodoro" ? "Pomodoros en el plan" : "Sin ciclos"}</span>
          </div>
        </div>
      </div>

      <div className="focus-layout">
        <section className={`card timer-card ${running ? "is-running" : ""}`}>
          <div className="timer-card-head">
            <div className="mode-switch" aria-label="Tipo de temporizador">
              <button
                className={mode === "pomodoro" ? "active" : ""}
                onClick={() => switchMode("pomodoro")}
              >
                Pomodoro
              </button>
              <button
                className={mode === "timer" ? "active" : ""}
                onClick={() => switchMode("timer")}
              >
                Temporizador
              </button>
            </div>
            <span className={`phase-label ${isBreak ? "phase-break" : "phase-work"}`}>
              <span className="phase-dot" />
              {phaseName}
            </span>
          </div>

          <div className="ring-wrap">
            <div className="ring-glow" />
            <svg viewBox="0 0 280 280" aria-label={`${formatTime(remaining)} restantes`}>
              <circle
                className="ring-bg"
                cx="140"
                cy="140"
                r={R}
                fill="none"
                strokeWidth="9"
              />
              <circle
                className="ring-fg"
                cx="140"
                cy="140"
                r={R}
                fill="none"
                strokeWidth="9"
                stroke={ringColor}
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
              />
            </svg>
            <div className="ring-time">
              <span className="ring-caption">{running ? "En curso" : "Preparado"}</span>
              <span className="digits">{formatTime(remaining)}</span>
              <span className="sub">
                {mode === "pomodoro"
                  ? `Bloque ${currentPom} de ${totalPlanPomodoros}`
                  : "Sesión individual"}
              </span>
            </div>
          </div>

          <div className="controls">
            {!running ? (
              <button
                className="btn btn-primary btn-start"
                onClick={start}
                disabled={!name.trim()}
              >
                <PlayIcon />
                {remaining < total ? "Continuar sesión" : "Empezar sesión"}
              </button>
            ) : (
              <button className="btn btn-primary btn-start" onClick={pause}>
                <PauseIcon />
                Pausar sesión
              </button>
            )}
            <button className="btn btn-icon" onClick={reset} title="Reiniciar sesión">
              <ResetIcon />
              <span>Reiniciar</span>
            </button>
            {mode === "pomodoro" && isBreak && (
              <button className="btn btn-ghost" onClick={skipPhase}>
                Saltar descanso
              </button>
            )}
          </div>

          <div className="timer-footer">
            {planDone ? (
              <p className="plan-done">Plan completado. Buen trabajo.</p>
            ) : (
              <p className="finish-info">
                {running ? "Terminarás" : "Si empiezas ahora, terminarás"} a las{" "}
                <strong>{finishAt}</strong>
              </p>
            )}
            {saveError && <p className="save-error">{saveError}</p>}
          </div>
        </section>

        <aside className="card session-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Configuración</span>
              <h2>{running ? "Sesión en marcha" : "Diseña tu sesión"}</h2>
            </div>
            <span className={`session-state ${running ? "live" : ""}`}>
              <span /> {running ? "Activa" : "En espera"}
            </span>
          </div>

          {!running && mode === "timer" && (
            <div className="setting-group">
              <span className="setting-title">Duraciones rápidas</span>
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
            </div>
          )}

          {!running && (
            <div className={`settings ${mode === "timer" ? "single" : ""}`}>
              {mode === "pomodoro" ? (
                <>
                  <Stepper
                    label="Concentración"
                    value={workMin}
                    onChange={setWorkMin}
                    step={5}
                    min={5}
                  />
                  <Stepper
                    label="Descanso corto"
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
                  <Stepper
                    label="Ciclos"
                    value={cycles}
                    onChange={setCycles}
                    step={1}
                    min={1}
                    max={8}
                    unit={cycles === 1 ? "ciclo" : "ciclos"}
                  />
                </>
              ) : (
                <Stepper
                  label="Duración personalizada"
                  value={timerMin}
                  onChange={setTimerMin}
                  step={5}
                  min={5}
                />
              )}
            </div>
          )}

          {running && (
            <div className="live-session-summary">
              <div>
                <span>Fase actual</span>
                <strong>{phaseName}</strong>
              </div>
              <div>
                <span>Tiempo restante</span>
                <strong>{formatTime(remaining)}</strong>
              </div>
              <div>
                <span>Final estimado</span>
                <strong>{finishAt}</strong>
              </div>
            </div>
          )}

          {mode === "pomodoro" && (
            <div className="plan-overview">
              <div className="plan-overview-head">
                <div>
                  <span className="setting-title">Progreso del plan</span>
                  <strong>{planPos} de {totalPlanPomodoros}</strong>
                </div>
                <span>{Math.round((planPos / totalPlanPomodoros) * 100)}%</span>
              </div>
              <div className="plan-dots" aria-label={`${planPos} de ${totalPlanPomodoros} completados`}>
                {Array.from({ length: totalPlanPomodoros }, (_, index) => (
                  <span
                    key={index}
                    className={`${index < planPos ? "done" : ""} ${index === planPos && phase === "work" && !planDone ? "current" : ""}`}
                  />
                ))}
              </div>
              <p>
                Cada ciclo combina {CYCLES_BEFORE_LONG_BREAK} bloques de enfoque,
                descansos cortos y un descanso largo final.
              </p>
            </div>
          )}

          <FocusTasks />

          <div className="focus-tip">
            <span className="focus-tip-icon">✦</span>
            <div>
              <strong>Consejo de enfoque</strong>
              <p>Silencia las notificaciones y define una sola tarea antes de empezar.</p>
            </div>
          </div>
        </aside>
      </div>

      <FriendsPanel />
    </div>
  );
}
