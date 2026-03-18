
export type ImageTab = 'character' | 'generate' | 'prompt-maker' | 'collage';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '2:3' | '3:4' | '4:3' | '4:5';
export type ReferenceMode = 'kreatif' | 'pose-background';
export type GenderSelection = 'wanita' | 'pria' | 'pria & wanita';

// --- NEW TYPES FOR IMAGE PRODUCTION ---

export interface CharacterFormData {
  region: string;
  customRegion?: string;
  userDescription?: string;
  framing: string; // New field for framing
  age: string;
  gender: string;
  genre: string;
  aspectRatio: AspectRatio;
}

export interface CharacterResult {
  id: string;
  summary: string;
  promptA: string;
  imageA?: string; // base64
  promptB: string;
  imageB?: string; // base64
  isLoadingA: boolean;
  isLoadingB: boolean;
  errorA?: string;
  errorB?: string;
  timestamp: number;
}

export interface PromptMakerFormData {
  idea: string;
  genre: string;
  angle: string;
}

export interface PromptMakerResult {
  id: string;
  idea: string;
  indoPrompt: string;
  engPrompt: string;
  timestamp: number;
}

export interface AdvancedImageFormData {
  aspectRatio: AspectRatio;
  prompt: string;
  count: number;
  filename?: string;
  focusItem?: string;
  refModel?: { data: string; mimeType: string };
  refTop?: { data: string; mimeType: string };
  refBottom?: { data: string; mimeType: string };
  refProduct?: { data: string; mimeType: string };
}

export interface AdvancedImageResult {
  id: string;
  filename: string;
  base64: string;
  prompt: string; // The prompt used
  videoPrompt?: string; // The generated Image-to-Video prompt
  isLoadingVideoPrompt: boolean;
  timestamp: number;
  aspectRatio: AspectRatio; // ADDED: To track ratio for previews
}
