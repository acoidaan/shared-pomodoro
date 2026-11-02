import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { firestore, hasFirebase } from "./firebaseClient";
import { ensureAnonymousUser, normalizeRoomCode } from "./rooms";

const LOCAL_KEY = "pomodoro-amigos-sessions";
const LOCAL_MIGRATION_KEY = "shared-pomodoro-firebase-migration";
const GLOBAL_MIGRATION_KEY = "shared-pomodoro-global-history-migration";

function readLocalSessions() {
  try {
    const sessions = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(sessions) ? sessions : [];
  } catch {
    return [];
  }
}

function completedAtMs(session) {
  const parsed = new Date(session.completed_at || session.completedAt).getTime();
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function sessionRow({ name, mode, minutes, ownerId, roomCode, timestamp }) {
  return {
    ownerId,
    roomCode: roomCode || null,
    name: name.trim() || "Invitado",
    mode: mode === "timer" ? "timer" : "pomodoro",
    minutes: Math.max(1, Math.min(600, Math.round(Number(minutes) || 1))),
    completedAt: serverTimestamp(),
    completedAtMs: timestamp || Date.now(),
  };
}

async function commitInChunks(rows, referenceFor) {
  for (let offset = 0; offset < rows.length; offset += 400) {
    const batch = writeBatch(firestore);
    for (const row of rows.slice(offset, offset + 400)) {
      batch.set(referenceFor(row), row.data);
    }
    await batch.commit();
  }
}

async function migrateLocalSessions(user) {
  const migrationId = `${LOCAL_MIGRATION_KEY}:${user.uid}`;
  if (localStorage.getItem(migrationId) === "done") return;

  const localSessions = readLocalSessions();
  const rows = localSessions.map((legacy) => ({
    data: sessionRow({
      name: legacy.name || "Invitado",
      mode: legacy.mode,
      minutes: legacy.minutes,
      ownerId: user.uid,
      roomCode: null,
      timestamp: completedAtMs(legacy),
    }),
  }));

  await commitInChunks(rows, () => doc(collection(firestore, "sessions")));
  localStorage.setItem(migrationId, "done");
}

async function migratePrivateHistory(user) {
  const migrationId = `${GLOBAL_MIGRATION_KEY}:${user.uid}`;
  if (localStorage.getItem(migrationId) === "done") return;

  const privateSessions = await getDocs(
    collection(firestore, "users", user.uid, "sessions"),
  );
  const rows = privateSessions.docs.map((legacy) => {
    const data = legacy.data();
    return {
      id: `${user.uid}_${legacy.id}`,
      data: {
        ...data,
        ownerId: user.uid,
        completedAtMs:
          Number(data.completedAtMs) || data.completedAt?.toMillis?.() || Date.now(),
      },
    };
  });

  await commitInChunks(rows, (row) => doc(firestore, "sessions", row.id));
  localStorage.setItem(migrationId, "done");
}

export async function saveSession({ name, mode, minutes, roomCode = null }) {
  if (!hasFirebase) {
    const row = {
      name,
      mode,
      minutes,
      completed_at: new Date().toISOString(),
    };
    const all = readLocalSessions();
    all.push(row);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
    return;
  }

  const user = await ensureAnonymousUser();
  const sessionRef = doc(collection(firestore, "sessions"));
  const cleanRoomCode = roomCode ? normalizeRoomCode(roomCode) : null;
  const row = sessionRow({
    name,
    mode,
    minutes,
    ownerId: user.uid,
    roomCode: cleanRoomCode,
  });

  if (!cleanRoomCode) {
    await setDoc(sessionRef, row);
    return;
  }

  const batch = writeBatch(firestore);
  batch.set(sessionRef, row);
  batch.set(
    doc(firestore, "rooms", cleanRoomCode, "sessions", sessionRef.id),
    row,
  );
  await batch.commit();
}

export async function loadSessions({ roomCode = null } = {}) {
  if (!hasFirebase) return readLocalSessions().slice().reverse();

  const user = await ensureAnonymousUser();
  if (!roomCode) {
    await migrateLocalSessions(user);
    await migratePrivateHistory(user);
  }

  const sessionsCollection = roomCode
    ? collection(
        firestore,
        "rooms",
        normalizeRoomCode(roomCode),
        "sessions",
      )
    : collection(firestore, "sessions");
  const snapshot = await getDocs(
    query(sessionsCollection, orderBy("completedAtMs", "desc"), limit(5000)),
  );

  return snapshot.docs.map((session) => {
    const data = session.data();
    const timestamp =
      Number(data.completedAtMs) || data.completedAt?.toMillis?.() || Date.now();
    return {
      id: session.id,
      ...data,
      completed_at: new Date(timestamp).toISOString(),
    };
  });
}
