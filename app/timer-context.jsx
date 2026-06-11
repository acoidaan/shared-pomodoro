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
import { supabase } from "../lib/supabaseClient";

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
    // Pequeño arpegio C5 - E5 - G5
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const t = audioCtx.currentTime + i * 0.18;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.5);
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

  // Sala en tiempo real (Supabase Presence)
  const [friends, setFriends] = useState([]);
  const [presenceReady, setPresenceReady] = useState(false);
  const channelRef = useRef(null);

  const endAtRef = useRef(null);
  const intervalRef = useRef(null);

  const totalPlanPomodoros = cycles * CYCLES_BEFORE_LONG_BREAK;

  // Cargar nombre guardado
  useEffect(() => {
    setNameState(localStorage.getItem("pomodoro-amigos-name") || "");
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
    if (running) return;
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

  // ---- Sala en tiempo real -------------------------------------------------
  // Cada cliente entra a un canal de presencia con su nombre como clave y
  // publica su estado (fase, si corre, cuándo termina). No usa la base de
  // datos: es un websocket efímero, al cerrar la pestaña desapareces solo.
  useEffect(() => {
    if (!supabase || !name.trim()) return;
    const channel = supabase.channel("sala-comun", {
      config: { presence: { key: name.trim() } },
    });
    channelRef.current = channel;
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setFriends(
        Object.entries(state).map(([key, metas]) => ({
          key,
          ...metas[metas.length - 1],
        })),
      );
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") setPresenceReady(true);
    });
    return () => {
      setPresenceReady(false);
      setFriends([]);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [name]);

  // Publicar mi estado cuando cambia algo relevante
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !presenceReady) return;
    channel.track({
      mode,
      phase,
      running,
      endAt: running ? endAtRef.current : null,
      total,
      updatedAt: Date.now(),
    });
  }, [presenceReady, running, phase, mode, total]);

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
      }).catch(() =>
        setSaveError(
          "No se pudo guardar la sesión. Revisa tu conexión o la configuración de Supabase.",
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
      }).catch(() =>
        setSaveError(
          "No se pudo guardar la sesión. Revisa tu conexión o la configuración de Supabase.",
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

  // Engancharse a la sesión en curso de un amigo: mismo fin, mismo reloj.
  const joinSession = useCallback((friend) => {
    if (!friend.running || !friend.endAt || friend.endAt <= Date.now()) return;
    unlockAudio();
    setMode(friend.mode);
    setPhase(friend.mode === "timer" ? "work" : friend.phase);
    setPlanDone(false);
    setTotal(friend.total);
    setRemaining((friend.endAt - Date.now()) / 1000);
    endAtRef.current = friend.endAt;
    setRunning(true);
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
    friends,
    start,
    pause,
    reset,
    skipPhase,
    switchMode,
    joinSession,
  };

  return (
    <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
  );
}
