export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "neurodivergent-therapist-sessions";
const ACTIVE_SESSION_KEY = "neurodivergent-therapist-active-session";
const VOICE_KEY = "neurodivergent-therapist-voice";

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function createSession(): Session {
  return {
    id: generateId(),
    title: "New conversation",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Session[];
  } catch {
    return [];
  }
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  const sessions = loadSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  session.updatedAt = Date.now();

  if (session.messages.length > 0 && session.title === "New conversation") {
    const firstUserMsg = session.messages.find((m) => m.role === "user");
    if (firstUserMsg) {
      session.title =
        firstUserMsg.content.length > 50
          ? firstUserMsg.content.slice(0, 50) + "..."
          : firstUserMsg.content;
    }
  }

  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.unshift(session);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function deleteSession(id: string): void {
  if (typeof window === "undefined") return;
  const sessions = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function setActiveSessionId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
}

export function getSavedVoice(): string {
  if (typeof window === "undefined") return "nova";
  return localStorage.getItem(VOICE_KEY) || "rachel";
}

export function saveVoice(voice: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VOICE_KEY, voice);
}
