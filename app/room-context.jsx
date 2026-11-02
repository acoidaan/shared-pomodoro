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
import { hasFirebase } from "../lib/firebaseClient";
import {
  joinRoom,
  removeRoomMember,
  subscribeToMembers,
  subscribeToRoom,
  syncRoomMember,
  updateRoomTimer,
} from "../lib/rooms";
import { useTimer } from "./timer-context";

const RoomContext = createContext(null);

export function useRoom() {
  return useContext(RoomContext);
}

export function RoomProvider({ code, children }) {
  const timer = useTimer();
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const [status, setStatus] = useState(hasFirebase ? "connecting" : "setup");
  const [error, setError] = useState("");
  const hydratedRef = useRef(false);
  const profileReady = timer.nameLoaded && Boolean(timer.name.trim());

  useEffect(() => {
    if (!hasFirebase || !profileReady) return;

    let active = true;
    let connectedUser = null;
    let unsubscribeRoom = () => {};
    let unsubscribeMembers = () => {};

    setStatus("connecting");
    setError("");

    joinRoom({ code, name: timer.name, tasks: timer.tasks })
      .then((joined) => {
        if (!active) return;
        connectedUser = joined.user;
        setUser(joined.user);

        unsubscribeRoom = subscribeToRoom(
          code,
          (nextRoom) => {
            if (!active) return;
            if (!nextRoom) {
              setStatus("missing");
              setError("Esta sala ya no existe o el enlace no es válido.");
              return;
            }

            setRoom(nextRoom);
            const isHost = nextRoom.hostId === joined.user.uid;
            if (nextRoom.timer && (!hydratedRef.current || !isHost)) {
              timer.syncSharedState(nextRoom.timer);
            }
            hydratedRef.current = true;
            setStatus("ready");
          },
          () => {
            if (!active) return;
            setStatus("error");
            setError("No se pudo mantener la conexión con la sala.");
          },
        );

        unsubscribeMembers = subscribeToMembers(
          code,
          (nextMembers) => active && setMembers(nextMembers),
          () => active && setError("No se pudieron cargar los participantes."),
        );
      })
      .catch((joinError) => {
        if (!active) return;
        setStatus(joinError.code === "ROOM_NOT_FOUND" ? "missing" : "error");
        setError(joinError.message || "No se pudo entrar en la sala.");
      });

    return () => {
      active = false;
      unsubscribeRoom();
      unsubscribeMembers();
      if (connectedUser) {
        removeRoomMember({ code, user: connectedUser }).catch(() => {});
      }
    };
    // La conexión se establece una sola vez por código y perfil cargado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, profileReady]);

  useEffect(() => {
    if (!user || status !== "ready") return;
    const timeout = window.setTimeout(() => {
      syncRoomMember({
        code,
        user,
        name: timer.name,
        tasks: timer.tasks,
      }).catch(() => setError("No se pudo actualizar tu lista en la sala."));
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [code, user, status, timer.name, timer.tasks]);

  useEffect(() => {
    if (!user || status !== "ready") return;
    const heartbeat = window.setInterval(() => {
      syncRoomMember({
        code,
        user,
        name: timer.name,
        tasks: timer.tasks,
      }).catch(() => {});
    }, 10000);
    return () => window.clearInterval(heartbeat);
  }, [code, user, status, timer.name, timer.tasks]);

  useEffect(() => {
    const interval = window.setInterval(() => setPresenceNow(Date.now()), 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user || status !== "ready") return;
    const handlePageHide = () => {
      removeRoomMember({ code, user }).catch(() => {});
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [code, user, status]);

  const activeMembers = useMemo(
    () =>
      members.filter((member) => {
        const rawLastSeen = member.lastSeenAt;
        const rawJoinedAt = member.joinedAt;
        const lastSeen =
          typeof rawLastSeen === "number"
            ? rawLastSeen
            : rawLastSeen?.toMillis?.() || rawJoinedAt?.toMillis?.() || 0;
        return lastSeen > 0 && presenceNow - lastSeen < 25000;
      }),
    [members, presenceNow],
  );

  const isHost = Boolean(room && user && room.hostId === user.uid);

  useEffect(() => {
    if (status !== "ready") return;
    timer.setSessionContext({ roomCode: code });
    return () => timer.setSessionContext(null);
  }, [code, status, timer.setSessionContext]);

  useEffect(() => {
    if (!isHost || !hydratedRef.current || status !== "ready") return;

    const timeout = window.setTimeout(() => {
      updateRoomTimer({
        code,
        timer: {
          mode: timer.mode,
          phase: timer.phase,
          running: timer.running,
          endsAt: timer.running ? Date.now() + timer.remaining * 1000 : null,
          remaining: timer.remaining,
          total: timer.total,
          workMin: timer.workMin,
          breakMin: timer.breakMin,
          longBreakMin: timer.longBreakMin,
          timerMin: timer.timerMin,
          cycles: timer.cycles,
          planPos: timer.planPos,
          planDone: timer.planDone,
        },
      }).catch(() => setError("No se pudo sincronizar el temporizador."));
    }, 120);

    return () => window.clearTimeout(timeout);
    // `remaining` se lee al cambiar el estado estructural, no en cada tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    code,
    isHost,
    status,
    timer.mode,
    timer.phase,
    timer.running,
    timer.total,
    timer.workMin,
    timer.breakMin,
    timer.longBreakMin,
    timer.timerMin,
    timer.cycles,
    timer.planPos,
    timer.planDone,
  ]);

  const leaveRoom = useCallback(async () => {
    if (user) await removeRoomMember({ code, user });
  }, [code, user]);

  const copyInvite = useCallback(async () => {
    const url = `${window.location.origin}/room/${code}`;
    await navigator.clipboard.writeText(url);
    return url;
  }, [code]);

  const value = useMemo(
    () => ({
      code,
      room,
      members: activeMembers,
      allMembers: members,
      user,
      status,
      error,
      isHost,
      copyInvite,
      leaveRoom,
    }),
    [
      code,
      room,
      activeMembers,
      members,
      user,
      status,
      error,
      isHost,
      copyInvite,
      leaveRoom,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}
