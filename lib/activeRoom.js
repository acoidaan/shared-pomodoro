"use client";

import { useEffect, useState } from "react";

const ACTIVE_ROOM_KEY = "shared-pomodoro-active-room";
const ACTIVE_ROOM_EVENT = "shared-pomodoro-active-room-change";

function cleanRoomCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function readActiveRoomCode() {
  if (typeof window === "undefined") return "";
  return cleanRoomCode(window.sessionStorage.getItem(ACTIVE_ROOM_KEY));
}

export function rememberActiveRoom(code) {
  if (typeof window === "undefined") return;
  const nextCode = cleanRoomCode(code);
  if (!nextCode) return;
  window.sessionStorage.setItem(ACTIVE_ROOM_KEY, nextCode);
  window.dispatchEvent(new CustomEvent(ACTIVE_ROOM_EVENT, { detail: nextCode }));
}

export function forgetActiveRoom(code) {
  if (typeof window === "undefined") return;
  const currentCode = readActiveRoomCode();
  const expectedCode = cleanRoomCode(code);
  if (expectedCode && currentCode && expectedCode !== currentCode) return;
  window.sessionStorage.removeItem(ACTIVE_ROOM_KEY);
  window.dispatchEvent(new CustomEvent(ACTIVE_ROOM_EVENT, { detail: "" }));
}

export function useActiveRoomCode() {
  const [code, setCode] = useState("");

  useEffect(() => {
    const syncCode = (event) => {
      setCode(cleanRoomCode(event?.detail) || readActiveRoomCode());
    };

    syncCode();
    window.addEventListener(ACTIVE_ROOM_EVENT, syncCode);
    return () => window.removeEventListener(ACTIVE_ROOM_EVENT, syncCode);
  }, []);

  return code;
}
