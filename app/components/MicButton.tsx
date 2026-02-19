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
  const [interimText, setInterimText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullTranscriptRef = useRef("");
  const hasSpokenRef = useRef(false);
  const wantListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);

  const SILENCE_TIMEOUT = 2000;

  // Keep callback ref current without causing re-renders
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      clearSilenceTimerFn();
      killRecognition();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-stop mic when AI starts playing, auto-restart when it stops
  useEffect(() => {
    if (isPlaying) {
      // AI is talking — stop listening
      wantListeningRef.current = false;
      clearSilenceTimerFn();
      killRecognition();
      setIsListening(false);
      setInterimText("");
    } else if (autoRestart && !disabled) {
      // AI finished talking — auto-start listening again
      const timer = setTimeout(() => {
        if (!wantListeningRef.current) {
          doStartListening();
        }
      }, 400);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, autoRestart, disabled]);

  function clearSilenceTimerFn() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function killRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
  }

  function doStopListening() {
    wantListeningRef.current = false;
    clearSilenceTimerFn();
    killRecognition();
    setIsListening(false);
    setInterimText("");
    fullTranscriptRef.current = "";
    hasSpokenRef.current = false;
  }

  function doStartListening() {
    if (disabled || isPlaying) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const W = window as any;
    const SpeechRecognitionAPI = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    // Clean up any existing instance
    killRecognition();
    clearSilenceTimerFn();

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    fullTranscriptRef.current = "";
    hasSpokenRef.current = false;
    setInterimText("");
    wantListeningRef.current = true;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalSoFar = "";
      let interimSoFar = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalSoFar += result[0].transcript;
        } else {
          interimSoFar += result[0].transcript;
        }
      }

      fullTranscriptRef.current = finalSoFar;
      setInterimText(interimSoFar);

      if (finalSoFar || interimSoFar) {
        hasSpokenRef.current = true;
      }

      // Reset silence timer whenever we get speech
      if (hasSpokenRef.current && finalSoFar) {
        clearSilenceTimerFn();
        silenceTimerRef.current = setTimeout(() => {
          const text = fullTranscriptRef.current.trim();
          if (text) {
            onTranscriptRef.current(text);
          }
          doStopListening();
        }, SILENCE_TIMEOUT);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        // On mobile, "no-speech" fires after a few seconds of silence
        // Restart recognition to keep listening
        if (wantListeningRef.current) {
          killRecognition();
          setTimeout(() => {
            if (wantListeningRef.current && !isPlaying) {
              doStartListening();
            }
          }, 100);
        }
        return;
      }
      if (event.error === "not-allowed") {
        alert("Microphone access was denied. Please allow microphone access in your browser settings.");
        doStopListening();
        return;
      }
      if (event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
      doStopListening();
    };

    recognition.onend = () => {
      // Recognition ended — if we still want to be listening, restart it
      // This handles mobile browsers that auto-stop after a few seconds
      if (wantListeningRef.current) {
        // Send any accumulated final text first
        const text = fullTranscriptRef.current.trim();
        if (text && hasSpokenRef.current) {
          onTranscriptRef.current(text);
          fullTranscriptRef.current = "";
          hasSpokenRef.current = false;
          setInterimText("");
          doStopListening();
        } else {
          // No speech yet — restart to keep listening
          recognitionRef.current = null;
          setTimeout(() => {
            if (wantListeningRef.current && !isPlaying) {
              doStartListening();
            }
          }, 100);
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
      doStopListening();
    }
  }

  const toggleMic = useCallback(() => {
    if (isListening || wantListeningRef.current) {
      // Manual stop — send whatever we have
      const text = fullTranscriptRef.current.trim();
      if (text) {
        onTranscriptRef.current(text);
      }
      doStopListening();
    } else {
      doStartListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, disabled, isPlaying]);

  const displayText = interimText || (isListening && hasSpokenRef.current ? fullTranscriptRef.current : "");

  return (
    <div className="flex flex-col items-center gap-1.5">
      {displayText ? (
        <div className="text-xs text-stone-500 max-w-[280px] text-center line-clamp-2 min-h-[18px] px-2">
          {displayText}
        </div>
      ) : (
        isListening && (
          <div className="text-xs text-stone-400 min-h-[18px]">Listening...</div>
        )
      )}
      <button
        onTouchEnd={(e) => {
          // Prevent ghost click + handle tap directly for mobile
          e.preventDefault();
          toggleMic();
        }}
        onClick={(e) => {
          // Desktop click — only fire if not from a touch
          if (e.detail > 0) {
            toggleMic();
          }
        }}
        disabled={disabled}
        className={`
          relative w-[72px] h-[72px] rounded-full transition-all duration-200
          flex items-center justify-center select-none
          ${
            disabled
              ? "bg-stone-200 text-stone-400 cursor-not-allowed"
              : isPlaying
                ? "bg-stone-300 text-stone-500"
                : isListening
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                  : "bg-blue-600 text-white shadow-lg shadow-blue-600/30 active:scale-95"
          }
        `}
        style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
      >
        {isListening && (
          <span className="absolute inset-[-6px] rounded-full border-[2.5px] border-red-400 animate-pulse opacity-60" />
        )}
        {isPlaying ? (
          <SpeakerIcon />
        ) : isListening ? (
          <MicActiveIcon />
        ) : (
          <MicIcon />
        )}
      </button>
      <span className="text-[11px] text-stone-400 select-none">
        {disabled
          ? "Thinking..."
          : isPlaying
            ? "Speaking..."
            : isListening
              ? "Listening \u00b7 tap to stop"
              : "Tap to talk"}
      </span>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function MicActiveIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" fill="none" strokeWidth="2" />
      <line x1="12" y1="19" x2="12" y2="22" strokeWidth="2" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
