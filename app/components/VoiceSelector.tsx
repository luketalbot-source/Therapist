"use client";

export const VOICES = [
  { id: "rachel", label: "Female (conversational)", shortLabel: "Rachel" },
  { id: "elli", label: "Female (warm)", shortLabel: "Elli" },
  { id: "antoni", label: "Male (warm)", shortLabel: "Antoni" },
  { id: "adam", label: "Male (deep)", shortLabel: "Adam" },
] as const;

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
}

export default function VoiceSelector({
  selectedVoice,
  onVoiceChange,
}: VoiceSelectorProps) {
  return (
    <div className="flex gap-1.5 items-center">
      {VOICES.map((voice) => (
        <button
          key={voice.id}
          onClick={() => onVoiceChange(voice.id)}
          className={`
            px-3 py-1.5 rounded-full text-xs font-medium transition-all
            ${
              selectedVoice === voice.id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white/60 text-stone-600 hover:bg-white/80"
            }
          `}
          title={voice.label}
        >
          {voice.shortLabel}
        </button>
      ))}
    </div>
  );
}
