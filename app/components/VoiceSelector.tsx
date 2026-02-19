"use client";

export const VOICES = [
  { id: "dr-lauren", label: "Dr Lauren", shortLabel: "Dr Lauren" },
  { id: "maria", label: "Maria", shortLabel: "Maria" },
  { id: "jerry-b", label: "Jerry B", shortLabel: "Jerry B" },
  { id: "matthew", label: "Matthew Wheeler", shortLabel: "Matthew" },
] as const;

// Map display IDs to ElevenLabs voice IDs
export const VOICE_ID_MAP: Record<string, string> = {
  "dr-lauren": "0G7xjh2pNSLRvJSpklE4",
  "maria": "5GR0JTHRVmv00OeaRI9u",
  "jerry-b": "zKb9yQZzbyTOE2hxatpu",
  "matthew": "gscOrkdeRphuXV3NcHOp",
};

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
}

export default function VoiceSelector({
  selectedVoice,
  onVoiceChange,
}: VoiceSelectorProps) {
  return (
    <div className="flex gap-1.5 items-center flex-wrap justify-center">
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
