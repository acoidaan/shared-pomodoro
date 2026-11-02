import { signInAnonymously } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  firebaseAuth,
  firestore,
  hasFirebase,
} from "./firebaseClient";
import { avatarColor } from "./avatar";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let signInPromise = null;

function requireFirebase() {
  if (!hasFirebase || !firebaseAuth || !firestore) {
    throw new Error("Firebase todavía no está configurado.");
  }
}

function randomRoomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return code;
}

export function normalizeRoomCode(value) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export async function ensureAnonymousUser() {
  requireFirebase();
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
  if (!signInPromise) {
    signInPromise = signInAnonymously(firebaseAuth)
      .then((credential) => credential.user)
      .catch((error) => {
        if (
          error.code === "auth/configuration-not-found" ||
          error.code === "auth/operation-not-allowed"
        ) {
          throw new Error(
            "Activa el proveedor Anónimo en Firebase Authentication para usar las salas.",
          );
        }
        throw error;
      })
      .finally(() => {
        signInPromise = null;
      });
  }
  return signInPromise;
}

function memberData(user, name, tasks = []) {
  const cleanName = name.trim() || "Invitado";
  return {
    uid: user.uid,
    name: cleanName,
    color: avatarColor(cleanName),
    tasks: tasks.slice(0, 12).map((task) => ({
      id: String(task.id),
      text: String(task.text).slice(0, 100),
      done: Boolean(task.done),
    })),
    lastSeenAt: Date.now(),
  };
}

export async function createRoom({ name, tasks, timer }) {
  const user = await ensureAnonymousUser();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomRoomCode();
    const roomRef = doc(firestore, "rooms", code);
    const memberRef = doc(firestore, "rooms", code, "members", user.uid);

    try {
      await runTransaction(firestore, async (transaction) => {
        const existing = await transaction.get(roomRef);
        if (existing.exists()) throw new Error("ROOM_CODE_COLLISION");

        transaction.set(roomRef, {
          code,
          title: `Sala de ${name.trim() || "enfoque"}`,
          hostId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          expiresAt: Date.now() + ROOM_TTL_MS,
          timerUpdatedBy: user.uid,
          timer,
        });
        transaction.set(memberRef, {
          ...memberData(user, name, tasks),
          joinedAt: serverTimestamp(),
        });
      });
      return code;
    } catch (error) {
      if (error.message !== "ROOM_CODE_COLLISION") throw error;
    }
  }

  throw new Error("No se pudo generar un código de sala. Inténtalo de nuevo.");
}

export async function joinRoom({ code, name, tasks }) {
  const cleanCode = normalizeRoomCode(code);
  const user = await ensureAnonymousUser();
  const roomRef = doc(firestore, "rooms", cleanCode);
  const snapshot = await getDoc(roomRef);

  if (!snapshot.exists()) {
    const error = new Error("No existe ninguna sala con ese código.");
    error.code = "ROOM_NOT_FOUND";
    throw error;
  }

  const room = snapshot.data();
  if (room.expiresAt && Number(room.expiresAt) <= Date.now()) {
    const error = new Error("Esta sala ha caducado por inactividad.");
    error.code = "ROOM_EXPIRED";
    throw error;
  }

  const memberRef = doc(
    firestore,
    "rooms",
    cleanCode,
    "members",
    user.uid,
  );
  await setDoc(
    memberRef,
    {
      ...memberData(user, name, tasks),
      joinedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return { code: cleanCode, user, room };
}

export function subscribeToRoom(code, onRoom, onError) {
  requireFirebase();
  return onSnapshot(
    doc(firestore, "rooms", normalizeRoomCode(code)),
    (snapshot) => onRoom(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null),
    onError,
  );
}

export function subscribeToMembers(code, onMembers, onError) {
  requireFirebase();
  return onSnapshot(
    collection(firestore, "rooms", normalizeRoomCode(code), "members"),
    (snapshot) =>
      onMembers(snapshot.docs.map((member) => ({ id: member.id, ...member.data() }))),
    onError,
  );
}

export async function removeRoomMember({ code, user }) {
  requireFirebase();
  if (!user) return;
  await deleteDoc(
    doc(
      firestore,
      "rooms",
      normalizeRoomCode(code),
      "members",
      user.uid,
    ),
  );
}

export async function syncRoomMember({ code, user, name, tasks }) {
  requireFirebase();
  if (!user) return;
  const memberRef = doc(
    firestore,
    "rooms",
    normalizeRoomCode(code),
    "members",
    user.uid,
  );
  await setDoc(memberRef, memberData(user, name, tasks), { merge: true });
}

export async function closeRoom({ code }) {
  requireFirebase();
  await ensureAnonymousUser();
  const cleanCode = normalizeRoomCode(code);
  const roomRef = doc(firestore, "rooms", cleanCode);
  const [members, sessions] = await Promise.all([
    getDocs(collection(firestore, "rooms", cleanCode, "members")),
    getDocs(collection(firestore, "rooms", cleanCode, "sessions")),
  ]);
  const references = [
    ...members.docs.map((item) => item.ref),
    ...sessions.docs.map((item) => item.ref),
  ];

  for (let offset = 0; offset < references.length; offset += 400) {
    const batch = writeBatch(firestore);
    for (const reference of references.slice(offset, offset + 400)) {
      batch.delete(reference);
    }
    await batch.commit();
  }

  await deleteDoc(roomRef);
}

export async function updateRoomTimer({ code, timer, updatedBy }) {
  requireFirebase();
  await updateDoc(doc(firestore, "rooms", normalizeRoomCode(code)), {
    timer,
    timerUpdatedBy: updatedBy,
    updatedAt: serverTimestamp(),
    expiresAt: Date.now() + ROOM_TTL_MS,
  });
}
