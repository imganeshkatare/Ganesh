export interface AudioState {
  isGenerating: boolean;
  isPlaying: boolean;
  audioBuffer: AudioBuffer | null;
  error: string | null;
  duration: number;
  currentTime: number;
}

export interface GenerationConfig {
  text: string;
  addAmbience: boolean;
}

export enum VoiceTone {
  DOCUMENTARY = "documentary",
  STORYTELLER = "storyteller"
}
