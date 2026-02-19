"use client";

import { useCallback, useRef, useState, useEffect } from "react";

interface PushToTalkProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  isPlaying?: boolean;
}

export default function PushToTalk({
  onTranscript,
  disabled,
  isPlaying,
}: PushToTalkProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  const isRecordingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    if (disabled || isPlaying) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    finalTranscriptRef.current = "";
    setInterimText("");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      finalTranscriptRef.current = final;
      setInterimText(interim);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error !== "aborted") {
        console.error("Speech recognition error:", event.error);
      }
      setIsRecording(false);
      isRecordingRef.current = false;
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        const text = (finalTranscriptRef.current + " " + interimText).trim();
        if (text) {
          onTranscript(text);
        }
      }
      setIsRecording(false);
      isRecordingRef.current = false;
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    isRecordingRef.current = true;
  }, [disabled, isPlaying, onTranscript, interimText]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      isRecordingRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      startRecording();
    },
    [startRecording]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      stopRecording();
    },
    [stopRecording]
  );

  return (
    <div className="flex flex-col items-center gap-2">
      {(isRecording || interimText) && (
        <div className="text-xs text-stone-500 max-w-[250px] text-center truncate min-h-[20px]">
          {interimText || finalTranscriptRef.current || "Listening..."}
        </div>
      )}
      <button
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        disabled={disabled}
        className={`
          relative w-20 h-20 rounded-full transition-all duration-200
          flex items-center justify-center
          select-none touch-none
          ${
            disabled
              ? "bg-stone-200 text-stone-400 cursor-not-allowed"
              : isRecording
                ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30"
                : isPlaying
                  ? "bg-stone-300 text-stone-500"
                  : "bg-blue-600 text-white shadow-lg shadow-blue-600/30 active:scale-110"
          }
        `}
      >
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30" />
            <span className="absolute inset-[-8px] rounded-full border-2 border-red-400 animate-pulse opacity-50" />
          </>
        )}
        {isPlaying ? (
          <SpeakerIcon />
        ) : isRecording ? (
          <MicActiveIcon />
        ) : (
          <MicIcon />
        )}
      </button>
      <span className="text-xs text-stone-400">
        {disabled
          ? "Thinking..."
          : isPlaying
            ? "Speaking..."
            : isRecording
              ? "Release to send"
              : "Hold to talk"}
      </span>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function MicActiveIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" fill="none" strokeWidth="2" />
      <line x1="12" y1="19" x2="12" y2="22" strokeWidth="2" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}
