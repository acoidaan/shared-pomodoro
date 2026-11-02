"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { saveSession } from "../lib/sessions";

export const CYCLES_BEFORE_LONG_BREAK = 4;

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// Un único AudioContext compartido, desbloqueado con el click de "Empezar".
// Si se creara en el momento de terminar el periodo, el navegador lo
// bloquearía por la política de autoplay y no sonaría nada.
let audioCtx = null;

function unlockAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {
    audioCtx = null;
  }
}

function playChime() {
  try {
    unlockAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(0.7, now);
    master.gain.setValueAtTime(0.72, now);
    filter.connect(master);
    master.connect(audioCtx.destination);

    // Tres campanas suaves y cálidas, con espacio entre ellas y cola larga.
    const notes = [
      { frequency: 392, delay: 0, volume: 0.11 },
      { frequency: 523.25, delay: 0.34, volume: 0.09 },
      { frequency: 659.25, delay: 0.72, volume: 0.075 },
    ];

    notes.forEach(({ frequency, delay, volume }) => {
      const startAt = now + delay;
      const stopAt = startAt + 2.1;
      const bellGain = audioCtx.createGain();
      bellGain.gain.setValueAtTime(0.0001, startAt);
      bellGain.gain.exponentialRampToValueAtTime(volume, startAt + 0.045);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
      bellGain.connect(filter);

      const fundamental = audioCtx.createOscillator();
      fundamental.type = "sine";
      fundamental.frequency.setValueAtTime(frequency, startAt);
      fundamental.detune.setValueAtTime(-3, startAt);
      fundamental.connect(bellGain);

      const overtone = audioCtx.createOscillator();
      const overtoneGain = audioCtx.createGain();
      overtone.type = "sine";
      overtone.frequency.setValueAtTime(frequency * 2.01, startAt);
      overtoneGain.gain.setValueAtTime(0.18, startAt);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.15);
      overtone.connect(overtoneGain);
      overtoneGain.connect(bellGain);

      fundamental.start(startAt);
      overtone.start(startAt);
      fundamental.stop(stopAt);
      overtone.stop(stopAt);
    });
  } catch {
    // sin sonido si el navegador lo bloquea
  }
}

function notify(message) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification("🍅 shared pomodoro", { body: message });
  }
}

const TimerContext = createContext(null);

export function useTimer() {
  return useContext(TimerContext);
}

export function TimerProvider({ children }) {
  const [name, setNameState] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);

  const [mode, setMode] = useState("pomodoro"); // 'pomodoro' | 'timer'

  // Ajustes (en minutos)
  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [timerMin, setTimerMin] = useState(30);
  const [cycles, setCycles] = useState(1); // ciclos del plan (1 ciclo = 4 pomodoros + descanso largo)

  // Estado del temporizador
  const [phase, setPhase] = useState("work"); // 'work' | 'break' | 'longBreak' (solo pomodoro)
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60); // segundos
  const [total, setTotal] = useState(25 * 60);
  const [completedPomodoros, setCompletedPomodoros] = useState(0); // total de la jornada
  const [planPos, setPlanPos] = useState(0); // pomodoros completados del plan actual
  const [planDone, setPlanDone] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [tasks, setTasks] = useState([]);

  const endAtRef = useRef(null);
  const intervalRef = useRef(null);
  const sharedSyncRef = useRef(false);
  const sessionContextRef = useRef({ roomCode: null });

  const totalPlanPomodoros = cycles * CYCLES_BEFORE_LONG_BREAK;

  // Cargar nombre guardado
  useEffect(() => {
    setNameState(localStorage.getItem("pomodoro-amigos-name") || "");
    try {
      const savedTasks = JSON.parse(
        localStorage.getItem("shared-pomodoro-focus-tasks") || "[]",
      );
      setTasks(Array.isArray(savedTasks) ? savedTasks.slice(0, 12) : []);
    } catch {
      setTasks([]);
    }
    setNameLoaded(true);
  }, []);

  // Atajo SOLO de desarrollo para probar el encadenado de fases sin esperar:
  // window.__ffPhase() adelanta la fase actual a 2 segundos del final.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    window.__ffPhase = () => {
      if (endAtRef.current) endAtRef.current = Date.now() + 2000;
    };
    return () => {
      delete window.__ffPhase;
    };
  }, []);

  const setName = useCallback((newName) => {
    setNameState(newName);
    localStorage.setItem("pomodoro-amigos-name", newName);
  }, []);

  const updateTasks = useCallback((updater) => {
    setTasks((current) => {
      const next = updater(current).slice(0, 12);
      localStorage.setItem(
        "shared-pomodoro-focus-tasks",
        JSON.stringify(next),
      );
      return next;
    });
  }, []);

  const addTask = useCallback(
    (text) => {
      const clean = text.trim();
      if (!clean) return;
      updateTasks((current) => [
        ...current,
        {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
          text: clean.slice(0, 100),
          done: false,
        },
      ]);
    },
    [updateTasks],
  );

  const toggleTask = useCallback(
    (taskId) => {
      updateTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, done: !task.done } : task,
        ),
      );
    },
    [updateTasks],
  );

  const removeTask = useCallback(
    (taskId) => {
      updateTasks((current) => current.filter((task) => task.id !== taskId));
    },
    [updateTasks],
  );

  const setSessionContext = useCallback((context) => {
    sessionContextRef.current = {
      roomCode: context?.roomCode || null,
    };
  }, []);

  const durationForPhase = useCallback(
    (ph) => {
      if (mode === "timer") return timerMin * 60;
      if (ph === "work") return workMin * 60;
      if (ph === "longBreak") return longBreakMin * 60;
      return breakMin * 60;
    },
    [mode, timerMin, workMin, breakMin, longBreakMin],
  );

  // Si cambian los ajustes de duración con el temporizador parado, actualizar la cuenta.
  // Ojo: `running` NO está en las dependencias a propósito — pausar no debe resetear el tiempo.
  useEffect(() => {
    if (running || sharedSyncRef.current) return;
    const d = durationForPhase(phase);
    setRemaining(d);
    setTotal(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationForPhase, phase]);

  // Título de la pestaña (vive en el provider: sigue actualizándose en cualquier página)
  useEffect(() => {
    if (running) {
      const label =
        mode === "timer" ? "Timer" : phase === "work" ? "Focus" : "Descanso";
      document.title = `${formatTime(remaining)} · ${label}`;
    } else {
      document.title = "shared pomodoro";
    }
  }, [remaining, running, mode, phase]);

  // Segundos que quedan para terminar TODO el plan (fase actual incluida).
  // Simula las fases que faltan: trabajos, descansos y el descanso largo final.
  const planRemainingSeconds = useMemo(() => {
    if (mode === "timer") return remaining;
    let secs = remaining;
    let pos = planPos;
    let ph = phase;
    for (let guard = 0; guard < 200; guard++) {
      if (ph === "work") {
        pos += 1;
        ph = pos % CYCLES_BEFORE_LONG_BREAK === 0 ? "longBreak" : "break";
        secs += (ph === "longBreak" ? longBreakMin : breakMin) * 60;
      } else {
        if (pos >= totalPlanPomodoros) break; // descanso largo final terminado
        ph = "work";
        secs += workMin * 60;
      }
    }
    return secs;
  }, [
    mode,
    remaining,
    planPos,
    phase,
    workMin,
    breakMin,
    longBreakMin,
    totalPlanPomodoros,
  ]);

  const handleComplete = useCallback(() => {
    setRunning(false);
    playChime();

    // Minutos reales de la sesión (importante al unirse al pomodoro de otro,
    // que puede durar distinto que tus propios ajustes)
    const sessionMinutes = Math.max(1, Math.round(total / 60));

    if (mode === "timer") {
      notify("¡Tiempo completado!");
      setSaveError("");
      saveSession({
        name: name.trim(),
        mode: "timer",
        minutes: sessionMinutes,
        roomCode: sessionContextRef.current.roomCode,
      }).catch(() =>
        setSaveError(
          "No se pudo guardar la sesión. Revisa tu conexión con Firebase.",
        ),
      );
      const d = timerMin * 60;
      setRemaining(d);
      setTotal(d);
      return;
    }

    if (phase === "work") {
      const pos = planPos + 1;
      setCompletedPomodoros(completedPomodoros + 1);
      setPlanPos(pos);
      setSaveError("");
      saveSession({
        name: name.trim(),
        mode: "pomodoro",
        minutes: sessionMinutes,
        roomCode: sessionContextRef.current.roomCode,
      }).catch(() =>
        setSaveError(
          "No se pudo guardar la sesión. Revisa tu conexión con Firebase.",
        ),
      );
      const nextPhase =
        pos % CYCLES_BEFORE_LONG_BREAK === 0 ? "longBreak" : "break";
      notify(
        nextPhase === "longBreak"
          ? "¡Pomodoro completado! Descanso largo 🎉"
          : "¡Pomodoro completado! Toca descansar.",
      );
      setPhase(nextPhase);
      // Los descansos empiezan solos
      const d = nextPhase === "longBreak" ? longBreakMin * 60 : breakMin * 60;
      setRemaining(d);
      setTotal(d);
      endAtRef.current = Date.now() + d * 1000;
      setRunning(true);
    } else if (planPos >= totalPlanPomodoros) {
      // Descanso largo del último ciclo terminado: plan completo
      notify("🎉 ¡Plan completado! Buen trabajo.");
      setPlanDone(true);
      setPlanPos(0);
      setPhase("work");
      const d = workMin * 60;
      setRemaining(d);
      setTotal(d);
    } else {
      // Fin de descanso: el siguiente pomodoro empieza solo
      notify("Descanso terminado. ¡A por el siguiente pomodoro!");
      setPhase("work");
      const d = workMin * 60;
      setRemaining(d);
      setTotal(d);
      endAtRef.current = Date.now() + d * 1000;
      setRunning(true);
    }
  }, [
    mode,
    phase,
    name,
    total,
    timerMin,
    workMin,
    breakMin,
    longBreakMin,
    completedPomodoros,
    planPos,
    totalPlanPomodoros,
  ]);

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

  const start = useCallback(() => {
    if (!name.trim()) return;
    unlockAudio();
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }
    setPlanDone(false);
    endAtRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  }, [name, remaining]);

  const pause = useCallback(() => {
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setPhase("work");
    setPlanPos(0);
    setPlanDone(false);
    const d = mode === "timer" ? timerMin * 60 : workMin * 60;
    setRemaining(d);
    setTotal(d);
  }, [mode, timerMin, workMin]);

  const skipPhase = useCallback(() => {
    if (mode !== "pomodoro" || phase === "work") return;
    if (planPos >= totalPlanPomodoros) {
      // Saltar el descanso largo final = dar el plan por terminado
      setRunning(false);
      setPlanDone(true);
      setPlanPos(0);
      setPhase("work");
      const d = workMin * 60;
      setRemaining(d);
      setTotal(d);
      return;
    }
    setPhase("work");
    const d = workMin * 60;
    setRemaining(d);
    setTotal(d);
    endAtRef.current = Date.now() + d * 1000;
    setRunning(true);
  }, [mode, phase, workMin, planPos, totalPlanPomodoros]);

  const switchMode = useCallback(
    (m) => {
      if (m === mode) return;
      setRunning(false);
      setMode(m);
      setPhase("work");
      setPlanPos(0);
      setPlanDone(false);
      const d = m === "timer" ? timerMin * 60 : workMin * 60;
      setRemaining(d);
      setTotal(d);
    },
    [mode, timerMin, workMin],
  );

  const syncSharedState = useCallback((sharedTimer) => {
    if (!sharedTimer) return;
    sharedSyncRef.current = true;

    const nextMode = sharedTimer.mode === "timer" ? "timer" : "pomodoro";
    const nextPhase = ["work", "break", "longBreak"].includes(
      sharedTimer.phase,
    )
      ? sharedTimer.phase
      : "work";
    const nextTotal = Math.max(1, Number(sharedTimer.total) || 25 * 60);
    const nextRunning = Boolean(sharedTimer.running && sharedTimer.endsAt);
    const nextRemaining = nextRunning
      ? Math.max(0, (Number(sharedTimer.endsAt) - Date.now()) / 1000)
      : Math.max(0, Number(sharedTimer.remaining) || nextTotal);

    setMode(nextMode);
    setPhase(nextPhase);
    setWorkMin(Math.max(1, Number(sharedTimer.workMin) || 25));
    setBreakMin(Math.max(1, Number(sharedTimer.breakMin) || 5));
    setLongBreakMin(Math.max(1, Number(sharedTimer.longBreakMin) || 15));
    setTimerMin(Math.max(1, Number(sharedTimer.timerMin) || 30));
    setCycles(Math.min(8, Math.max(1, Number(sharedTimer.cycles) || 1)));
    setPlanPos(Math.max(0, Number(sharedTimer.planPos) || 0));
    setPlanDone(Boolean(sharedTimer.planDone));
    setTotal(nextTotal);
    setRemaining(nextRemaining);
    endAtRef.current = nextRunning ? Number(sharedTimer.endsAt) : null;
    setRunning(nextRunning && nextRemaining > 0);

    window.setTimeout(() => {
      sharedSyncRef.current = false;
    }, 0);
  }, []);

  const value = {
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
    tasks,
    addTask,
    toggleTask,
    removeTask,
    syncSharedState,
    setSessionContext,
    start,
    pause,
    reset,
    skipPhase,
    switchMode,
  };

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
