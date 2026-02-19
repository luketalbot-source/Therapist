"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import MessageBubble from "./MessageBubble";
import MicButton from "./MicButton";
import VoiceSelector from "./VoiceSelector";
import SessionSidebar from "./SessionSidebar";
import WelcomeScreen from "./WelcomeScreen";
import {
  Session,
  Message,
  createSession,
  loadSessions,
  saveSession,
  deleteSession,
  getActiveSessionId,
  setActiveSessionId,
  getSavedVoice,
  saveVoice,
} from "@/lib/sessions";

export default function ChatInterface() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [voice, setVoice] = useState("rachel");
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [micActive, setMicActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Create a persistent audio element on mount for iOS compatibility
  // iOS Safari requires audio to be played from a user gesture context,
  // and reusing the same element helps maintain that context
  useEffect(() => {
    const audio = new Audio();
    // playsInline and webkitPlaysInline are needed for iOS Safari
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const a = audio as any;
    a.playsInline = true;
    a.webkitPlaysInline = true;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  // Load saved state on mount
  useEffect(() => {
    const savedSessions = loadSessions();
    const savedVoice = getSavedVoice();
    const activeId = getActiveSessionId();

    setSessions(savedSessions);
    setVoice(savedVoice);

    if (activeId) {
      const active = savedSessions.find((s) => s.id === activeId);
      if (active) {
        setSession(active);
        setHasStarted(true);
      }
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, streamingText]);

  const handleVoiceChange = useCallback((v: string) => {
    setVoice(v);
    saveVoice(v);
  }, []);

  // "Prime" the audio element with a silent buffer on user interaction
  // This unlocks audio playback on iOS
  const primeAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // Create a tiny silent wav
    const silence =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    audio.src = silence;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
    }).catch(() => {});
  }, []);

  const startConversation = useCallback(async () => {
    // Prime audio on this user gesture (critical for iOS)
    primeAudio();

    const newSession = createSession();
    setSession(newSession);
    setActiveSessionId(newSession.id);
    setHasStarted(true);

    // Get initial greeting from AI
    setIsLoading(true);
    try {
      const greeting = await fetchAIResponse([]);
      if (greeting) {
        newSession.messages = [{ role: "assistant", content: greeting }];
        saveSession(newSession);
        setSession({ ...newSession });
        setSessions(loadSessions());
        await playTTS(greeting);
      }
    } catch (error) {
      console.error("Failed to get greeting:", error);
      newSession.messages = [
        {
          role: "assistant",
          content:
            "Hey! Welcome. I'm glad you're here. How's your day going so far?",
        },
      ];
      saveSession(newSession);
      setSession({ ...newSession });
      setSessions(loadSessions());
    }
    setIsLoading(false);
    setMicActive(true);
  }, [voice]);

  const fetchAIResponse = async (messages: Message[]): Promise<string> => {
    abortRef.current = new AbortController();

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: abortRef.current.signal,
    });

    if (!response.ok) throw new Error("Chat request failed");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
              setStreamingText(fullText);
            }
          } catch {}
        }
      }
    }

    setStreamingText("");
    return fullText;
  };

  const playTTS = async (text: string) => {
    try {
      setIsPlaying(true);
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });

      if (!response.ok) {
        console.error("TTS request failed:", response.status);
        setIsPlaying(false);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const audio = audioRef.current;
      if (!audio) {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        return;
      }

      // Set up event handlers
      const cleanup = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
      };

      audio.onended = cleanup;
      audio.onerror = () => {
        console.error("Audio playback error");
        cleanup();
      };

      audio.src = url;

      try {
        await audio.play();
      } catch (e) {
        console.error("Audio play failed:", e);
        cleanup();
      }
    } catch (error) {
      console.error("TTS error:", error);
      setIsPlaying(false);
    }
  };

  const handleTranscript = useCallback(
    async (text: string) => {
      if (!session || isLoading) return;

      // Stop any playing audio
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }

      const userMessage: Message = { role: "user", content: text };
      const updatedMessages = [...session.messages, userMessage];

      const updatedSession = { ...session, messages: updatedMessages };
      setSession(updatedSession);
      saveSession(updatedSession);
      setSessions(loadSessions());

      setIsLoading(true);
      try {
        const response = await fetchAIResponse(updatedMessages);
        if (response) {
          const aiMessage: Message = { role: "assistant", content: response };
          const finalMessages = [...updatedMessages, aiMessage];
          const finalSession = { ...updatedSession, messages: finalMessages };
          setSession(finalSession);
          saveSession(finalSession);
          setSessions(loadSessions());

          await playTTS(response);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to get response:", error);
        }
      }
      setIsLoading(false);
    },
    [session, isLoading, voice]
  );

  const handleSelectSession = useCallback((id: string) => {
    const allSessions = loadSessions();
    const selected = allSessions.find((s) => s.id === id);
    if (selected) {
      setSession(selected);
      setActiveSessionId(id);
      setHasStarted(true);
      setMicActive(true);
    }
  }, []);

  const handleNewSession = useCallback(() => {
    setHasStarted(false);
    setSession(null);
    setMicActive(false);
  }, []);

  const handleDeleteSession = useCallback(
    (id: string) => {
      deleteSession(id);
      const remaining = loadSessions();
      setSessions(remaining);
      if (session?.id === id) {
        if (remaining.length > 0) {
          setSession(remaining[0]);
          setActiveSessionId(remaining[0].id);
        } else {
          setSession(null);
          setHasStarted(false);
          setMicActive(false);
        }
      }
    },
    [session]
  );

  if (!hasStarted) {
    return (
      <WelcomeScreen
        selectedVoice={voice}
        onVoiceChange={handleVoiceChange}
        onStart={startConversation}
      />
    );
  }

  return (
    <div className="flex flex-col h-[100dvh]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white/70 backdrop-blur-md border-b border-stone-200/50 safe-top">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-stone-100 text-stone-600"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <VoiceSelector selectedVoice={voice} onVoiceChange={handleVoiceChange} />

        <div className="w-8" />
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth">
        {session?.messages.map((msg, i) => (
          <MessageBubble key={i} role={msg.role} content={msg.content} />
        ))}
        {streamingText && (
          <MessageBubble role="assistant" content={streamingText} isStreaming />
        )}
        {isLoading && !streamingText && (
          <div className="flex justify-start mb-3">
            <div className="bg-white/80 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" />
                <span
                  className="w-2 h-2 bg-stone-300 rounded-full animate-bounce"
                  style={{ animationDelay: "0.15s" }}
                />
                <span
                  className="w-2 h-2 bg-stone-300 rounded-full animate-bounce"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 pb-5 safe-bottom">
        <div className="flex items-end gap-3 max-w-lg mx-auto">
          <form
            className="flex-1 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (textInput.trim() && !isLoading) {
                handleTranscript(textInput.trim());
                setTextInput("");
              }
            }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isLoading}
              className="flex-1 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-[15px]
                         text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2
                         focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !textInput.trim()}
              className="rounded-2xl bg-blue-600 text-white px-4 py-3 text-sm font-medium
                         disabled:opacity-30 hover:bg-blue-700 transition-colors shrink-0"
            >
              Send
            </button>
          </form>
          <MicButton
            onTranscript={handleTranscript}
            disabled={isLoading}
            isPlaying={isPlaying}
            autoRestart={micActive}
          />
        </div>
      </div>

      {/* Session Sidebar */}
      <SessionSidebar
        sessions={sessions}
        activeSessionId={session?.id || ""}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </div>
  );
}
