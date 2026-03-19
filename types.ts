
export type ImageTab = 'character' | 'generate' | 'group' | 'prompt-maker' | 'collage';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '2:3' | '3:4' | '4:3' | '4:5';
export type ReferenceMode = 'kreatif' | 'pose-background';
export type GenderSelection = 'wanita' | 'pria' | 'pria & wanita';

// --- NEW TYPES FOR IMAGE PRODUCTION ---

export interface CharacterFormData {
  region: string;
  customRegion?: string;
  userDescription?: string;
  framing: string;
  age: string;
  gender: string;
  genre: string;
  aspectRatio: AspectRatio;
}

export interface CharacterResult {
  id: string;
  summary: string;
  promptA: string;
  imageA?: string;
  promptB: string;
  imageB?: string;
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
  poseMode?: 'random' | 'lock';
  outfitMode?: 'lock' | 'random';
  /**
   * Framing / shot type pilihan user
   * 'auto' = AI pilih sendiri (acak dari SCENE_SUB_VARIATIONS)
   */
  framing?: 'auto' | 'close_up' | 'medium' | 'full_body' | 'wide';
  refModel?: { data: string; mimeType: string };
  refTop?: { data: string; mimeType: string };
  refBottom?: { data: string; mimeType: string };
  refProduct?: { data: string; mimeType: string };
  refProductDesc?: string;
}

export interface AdvancedImageResult {
  id: string;
  filename: string;
  base64: string;
  prompt: string;
  videoPrompt?: string;
  isLoadingVideoPrompt: boolean;
  timestamp: number;
  aspectRatio: AspectRatio;
}

// --- SCENE PRESET ---
export interface ScenePreset {
  id: string;
  category: string;
  label: string;
  icon: string;
  prompt: string;
}

// --- GROUP PHOTO ---
export interface GroupPerson {
  id: string;
  label: string;      // "Ayah", "Bunda", "Kakak", dll
  age: number | '';   // usia untuk proporsi tinggi
  image?: { data: string; mimeType: string };
}

export interface GroupPhotoFormData {
  persons: GroupPerson[];
  scene: string;
  aspectRatio: AspectRatio;
  framing?: 'auto' | 'close_up' | 'medium' | 'full_body' | 'wide';
}

export interface GroupPhotoResult {
  id: string;
  base64: string;
  scene: string;
  timestamp: number;
  aspectRatio: AspectRatio;
}


// --- NEW TYPES FOR IMAGE PRODUCTION ---

export interface CharacterFormData {
  region: string;
  customRegion?: string;
  userDescription?: string;
  framing: string;
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
  /**
   * 'random' = variasi pose acak setiap generate (default)
   * 'lock'   = pertahankan pose / postur dari refModel
   */
  poseMode?: 'random' | 'lock';
  /**
   * 'lock'   = pertahankan pakaian dari refModel (default)
   * 'random' = AI bebas memilih pakaian sesuai scene/prompt
   * Try-on (refTop/refBottom) tetap berlaku terlepas dari outfitMode
   */
  outfitMode?: 'lock' | 'random';
  refModel?: { data: string; mimeType: string };
  refTop?: { data: string; mimeType: string };
  refBottom?: { data: string; mimeType: string };
  refProduct?: { data: string; mimeType: string };
  /**
   * Deskripsi detail produk (opsional) untuk membantu AI
   * mempertahankan akurasi produk lebih baik.
   * Contoh: "Botol kaca 250ml, label putih, logo merah oval di tengah,
   *          tutup hitam, tulisan 'BRAND X' ukuran besar"
   */
  refProductDesc?: string;
}

export interface AdvancedImageResult {
  id: string;
  filename: string;
  base64: string;
  prompt: string;
  videoPrompt?: string;
  isLoadingVideoPrompt: boolean;
  timestamp: number;
  aspectRatio: AspectRatio;
}
