"use client";

import { useState } from "react";
import { hasSupabase } from "../lib/supabaseClient";
import { avatarColor } from "../lib/avatar";
import { useTimer } from "./timer-context";

export default function FocusTasks() {
  const { name, tasks, addTask, toggleTask, removeTask } = useTimer();
  const [draft, setDraft] = useState("");
  const color = avatarColor(name || "Usuario");
  const completed = tasks.filter((task) => task.done).length;

  const submit = (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    addTask(draft);
    setDraft("");
  };

  return (
    <section className="focus-list" style={{ "--user-color": color }}>
      <div className="focus-list-head">
        <div>
          <span className="setting-title">Mi lista de enfoque</span>
          <strong>
            {tasks.length === 0
              ? "¿Qué quieres sacar adelante?"
              : `${completed} de ${tasks.length} completadas`}
          </strong>
        </div>
        <span className="focus-list-color" title="Tu color en la sala" />
      </div>

      <form className="task-form" onSubmit={submit}>
        <input
          type="text"
          value={draft}
          maxLength={100}
          placeholder="Añadir una tarea…"
          aria-label="Nueva tarea"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" disabled={!draft.trim()} aria-label="Añadir tarea">
          +
        </button>
      </form>

      {tasks.length > 0 ? (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id} className={task.done ? "done" : ""}>
              <button
                type="button"
                className="task-check"
                aria-label={task.done ? "Marcar como pendiente" : "Marcar como completada"}
                onClick={() => toggleTask(task.id)}
              >
                {task.done && "✓"}
              </button>
              <span>{task.text}</span>
              <button
                type="button"
                className="task-remove"
                aria-label={`Eliminar ${task.text}`}
                onClick={() => removeTask(task.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="task-empty">
          Añade entre una y tres prioridades para mantener la sesión clara.
        </p>
      )}

      <p className="task-sharing-state">
        <span />
        {hasSupabase
          ? "Las personas conectadas pueden ver esta lista en tiempo real"
          : "Guardada en este dispositivo; se compartirá al entrar en una sala"}
      </p>
    </section>
  );
}
