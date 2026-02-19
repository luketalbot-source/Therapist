"use client";

import { useCallback, useRef, useState, useEffect } from "react";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  isPlaying?: boolean;
}

export default function MicButton({
  onTranscript,
  disabled,
  isPlaying,
}: MicButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullTranscriptRef = useRef("");
  const hasSpokenRef = useRef(false);

  const SILENCE_TIMEOUT = 1800; // ms of silence before auto-sending

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Auto-stop mic when AI starts playing audio
  useEffect(() => {
    if (isPlaying && isListening) {
      stopListening();
    }
  }, [isPlaying]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // Silence detected — send what we have and stop
      const text = fullTranscriptRef.current.trim();
      if (text) {
        onTranscript(text);
        fullTranscriptRef.current = "";
        setInterimText("");
        hasSpokenRef.current = false;
      }
      stopListening();
    }, SILENCE_TIMEOUT);
  }, [clearSilenceTimer, onTranscript]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText("");
    fullTranscriptRef.current = "";
    hasSpokenRef.current = false;
  }, [clearSilenceTimer]);

  const startListening = useCallback(() => {
    if (disabled || isPlaying) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    fullTranscriptRef.current = "";
    hasSpokenRef.current = false;
    setInterimText("");

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

      // Reset silence timer on any new speech
      if (hasSpokenRef.current) {
        startSilenceTimer();
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        // No speech detected — just keep listening, don't stop
        return;
      }
      if (event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
      stopListening();
    };

    recognition.onend = () => {
      // Web Speech API can stop on its own (e.g. long silence, mobile background)
      // If we're still supposed to be listening, restart it
      if (recognitionRef.current === recognition) {
        // Send any accumulated text first
        const text = fullTranscriptRef.current.trim();
        if (text) {
          onTranscript(text);
          fullTranscriptRef.current = "";
          hasSpokenRef.current = false;
        }
        setIsListening(false);
        setInterimText("");
        recognitionRef.current = null;
        clearSilenceTimer();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [disabled, isPlaying, onTranscript, startSilenceTimer, stopListening, clearSilenceTimer]);

  const toggleMic = useCallback(() => {
    if (isListening) {
      // Manual stop — send whatever we have
      const text = fullTranscriptRef.current.trim();
      if (text) {
        onTranscript(text);
      }
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, onTranscript, stopListening, startListening]);

  const displayText = interimText || (isListening && hasSpokenRef.current ? fullTranscriptRef.current : "");

  return (
    <div className="flex flex-col items-center gap-2">
      {displayText ? (
        <div className="text-xs text-stone-500 max-w-[280px] text-center line-clamp-2 min-h-[20px] px-2">
          {displayText}
        </div>
      ) : (
        isListening && (
          <div className="text-xs text-stone-400 min-h-[20px]">Listening...</div>
        )
      )}
      <button
        onClick={toggleMic}
        disabled={disabled}
        className={`
          relative w-16 h-16 rounded-full transition-all duration-200
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
      >
        {isListening && (
          <span className="absolute inset-[-4px] rounded-full border-2 border-red-400 animate-pulse opacity-60" />
        )}
        {isPlaying ? (
          <SpeakerIcon />
        ) : isListening ? (
          <MicActiveIcon />
        ) : (
          <MicIcon />
        )}
      </button>
      <span className="text-[11px] text-stone-400">
        {disabled
          ? "Thinking..."
          : isPlaying
            ? "Speaking..."
            : isListening
              ? "Tap to stop"
              : "Tap to talk"}
      </span>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function MicActiveIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" fill="none" strokeWidth="2" />
      <line x1="12" y1="19" x2="12" y2="22" strokeWidth="2" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
