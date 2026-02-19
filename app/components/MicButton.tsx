"use client";

import { useCallback, useRef, useState, useEffect } from "react";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  isPlaying?: boolean;
  autoRestart?: boolean;
}

export default function MicButton({
  onTranscript,
  disabled,
  isPlaying,
  autoRestart,
}: MicButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [displayText, setDisplayText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bestTranscriptRef = useRef("");
  const lastActivityRef = useRef(0);
  const wantListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);

  // How long to wait after last speech before auto-sending
  const SILENCE_MS = 1800;

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      clearTimer();
      killRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When AI starts playing → stop mic. When AI stops → auto-restart mic.
  useEffect(() => {
    if (isPlaying) {
      wantListeningRef.current = false;
      clearTimer();
      killRecognition();
      setIsListening(false);
      setDisplayText("");
      bestTranscriptRef.current = "";
    } else if (autoRestart && !disabled) {
      const t = setTimeout(() => {
        if (!wantListeningRef.current && !disabled) {
          startListening();
        }
      }, 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, autoRestart, disabled]);

  function clearTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function killRecognition() {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
  }

  function sendAndStop() {
    const text = bestTranscriptRef.current.trim();
    if (text) {
      onTranscriptRef.current(text);
    }
    wantListeningRef.current = false;
    clearTimer();
    killRecognition();
    setIsListening(false);
    setDisplayText("");
    bestTranscriptRef.current = "";
  }

  function resetSilenceTimer() {
    clearTimer();
    lastActivityRef.current = Date.now();
    silenceTimerRef.current = setTimeout(() => {
      // Only send if we actually have text
      if (bestTranscriptRef.current.trim()) {
        sendAndStop();
      }
    }, SILENCE_MS);
  }

  function startListening() {
    if (disabled || isPlaying) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const W = window as any;
    const SpeechAPI = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechAPI) {
      alert("Speech recognition is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    killRecognition();
    clearTimer();

    const recognition = new SpeechAPI();
    // On mobile Safari, continuous=false is more reliable
    // It fires onend after each phrase, and we restart it
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    recognition.continuous = !isMobile;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    // Increase maxAlternatives for better accuracy
    recognition.maxAlternatives = 1;

    bestTranscriptRef.current = "";
    wantListeningRef.current = true;
    setDisplayText("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let transcript = "";
      let hasInterim = false;

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        transcript += result[0].transcript;
        if (!result.isFinal) hasInterim = true;
      }

      if (transcript) {
        bestTranscriptRef.current = transcript;
        setDisplayText(transcript);
        // Any speech activity resets the silence timer
        resetSilenceTimer();
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        // Mobile fires this often — restart if we want to keep listening
        if (wantListeningRef.current) {
          killRecognition();
          setTimeout(() => {
            if (wantListeningRef.current && !isPlaying) {
              startListening();
            }
          }, 200);
        }
        return;
      }
      if (event.error === "not-allowed") {
        alert("Please allow microphone access to use voice input.");
        wantListeningRef.current = false;
        clearTimer();
        setIsListening(false);
        return;
      }
      if (event.error !== "aborted") {
        console.error("Speech error:", event.error);
      }
      // For other errors, try restarting if we want to keep listening
      if (wantListeningRef.current) {
        killRecognition();
        setTimeout(() => {
          if (wantListeningRef.current && !isPlaying) {
            startListening();
          }
        }, 300);
      }
    };

    recognition.onend = () => {
      // Recognition ended — on mobile this happens after every phrase
      if (wantListeningRef.current) {
        // If we have text and no new speech comes in, the silence timer will fire
        // Meanwhile, restart recognition to catch more speech
        recognitionRef.current = null;
        setTimeout(() => {
          if (wantListeningRef.current && !isPlaying) {
            // Don't clear bestTranscript — we're accumulating across restarts
            const saved = bestTranscriptRef.current;

            killRecognition();
            clearTimer(); // Will be reset by next onresult

            const newRecognition = new SpeechAPI();
            newRecognition.continuous = !isMobile;
            newRecognition.interimResults = true;
            newRecognition.lang = "en-US";

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            newRecognition.onresult = (event: any) => {
              let transcript = "";
              for (let i = 0; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
              }
              if (transcript) {
                // Append new speech to what we already had
                bestTranscriptRef.current = saved ? saved + " " + transcript : transcript;
                setDisplayText(bestTranscriptRef.current);
                resetSilenceTimer();
              }
            };
            newRecognition.onerror = recognition.onerror;
            newRecognition.onend = recognition.onend;

            recognitionRef.current = newRecognition;
            try {
              newRecognition.start();
            } catch {
              // If start fails, send what we have
              if (saved.trim()) {
                bestTranscriptRef.current = saved;
                sendAndStop();
              }
            }

            // If we had text from before and no new speech comes, send after timeout
            if (saved.trim()) {
              resetSilenceTimer();
            }
          }
        }, 150);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.error("Failed to start recognition:", e);
      wantListeningRef.current = false;
      setIsListening(false);
    }
  }

  const toggleMic = useCallback(() => {
    if (isListening || wantListeningRef.current) {
      sendAndStop();
    } else {
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, disabled, isPlaying]);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onTouchEnd={(e) => {
          e.preventDefault();
          toggleMic();
        }}
        onClick={() => {
          toggleMic();
        }}
        disabled={disabled}
        className={`
          relative w-24 h-24 rounded-full transition-all duration-200
          flex items-center justify-center select-none
          ${
            disabled
              ? "bg-stone-200 text-stone-400 cursor-not-allowed"
              : isPlaying
                ? "bg-stone-300 text-stone-500"
                : isListening
                  ? "bg-red-500 text-white shadow-xl shadow-red-500/30 scale-105"
                  : "bg-blue-600 text-white shadow-xl shadow-blue-600/30 active:scale-95"
          }
        `}
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        {isListening && (
          <span className="absolute inset-[-8px] rounded-full border-[3px] border-red-400 animate-pulse opacity-50" />
        )}
        {isPlaying ? (
          <SpeakerIcon />
        ) : isListening ? (
          <MicActiveIcon />
        ) : (
          <MicIcon />
        )}
      </button>

      {displayText ? (
        <div className="text-sm text-stone-600 max-w-[300px] text-center line-clamp-2 px-4 min-h-[40px] flex items-center">
          {displayText}
        </div>
      ) : (
        <div className="text-xs text-stone-400 min-h-[40px] flex items-center">
          {disabled
            ? "Thinking..."
            : isPlaying
              ? "Speaking..."
              : isListening
                ? "Listening..."
                : "Tap to talk"}
        </div>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function MicActiveIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" fill="none" strokeWidth="1.5" />
      <line x1="12" y1="19" x2="12" y2="22" strokeWidth="1.5" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
