"use client";

import VoiceSelector from "./VoiceSelector";

interface WelcomeScreenProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  onStart: () => void;
}

export default function WelcomeScreen({
  selectedVoice,
  onVoiceChange,
  onStart,
}: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center">
      <div className="max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center mx-auto mb-6">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-blue-600"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-stone-800 mb-3">
          Let&apos;s have a conversation
        </h1>
        <p className="text-stone-500 text-[15px] leading-relaxed mb-8">
          This is a safe space to talk about how you experience the world.
          Through natural conversation, we might notice some interesting
          patterns together.
        </p>

        <div className="bg-white/60 rounded-2xl p-4 mb-6">
          <p className="text-xs text-stone-400 mb-3">Choose a voice</p>
          <div className="flex justify-center">
            <VoiceSelector
              selectedVoice={selectedVoice}
              onVoiceChange={onVoiceChange}
            />
          </div>
        </div>

        <button
          onClick={onStart}
          className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-medium text-[15px]
                     hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20
                     active:scale-[0.98]"
        >
          Start Conversation
        </button>

        <p className="text-[11px] text-stone-400 mt-6 leading-relaxed">
          This is not a diagnostic tool. It&apos;s a conversation designed to
          help you explore patterns in how you think and experience the world.
          Always consult a qualified professional for formal evaluation.
        </p>
      </div>
    </div>
  );
}
