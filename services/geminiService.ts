import { GoogleGenAI, Modality, Part, Schema, Type } from "@google/genai";
import { AspectRatio, ReferenceMode, GenderSelection, CharacterFormData, CharacterResult, PromptMakerFormData, PromptMakerResult, AdvancedImageFormData, AdvancedImageResult } from '../types';
import { MODEL_REGIONS, CHARACTER_FRAMINGS } from "../constants";

// ============================================================
// HELPER: Ambil API Key dari localStorage (diisi user di UI)
// Fallback ke environment variable jika ada (untuk development lokal)
// ============================================================
const getApiKey = (): string => {
  const key = localStorage.getItem('gemini_api_key') || process.env.API_KEY || '';
  if (!key) {
    throw new Error('API Key tidak ditemukan. Silakan masukkan Google AI Studio API Key kamu di bagian atas halaman.');
  }
  return key;
};

// ============================================================
// VARIASI KOMPOSISI — bervariasi DALAM lokasi dari prompt user
// (tidak mengganti lokasi, hanya memvariasikan sudut, momen, kedalaman)
// Pose TIDAK lagi hardcoded — AI memilih pose yang natural sesuai scene
// ============================================================
const SCENE_SUB_VARIATIONS = [
  { camera: "medium shot, eye-level angle, subject centered", moment: "candid, caught mid-motion", depth: "shallow depth of field, background softly blurred" },
  { camera: "slightly low-angle shot looking up, dynamic perspective", moment: "confident pause, looking directly at camera", depth: "moderate depth of field, environment visible" },
  { camera: "three-quarter angle shot from the left", moment: "natural walking motion, mid-stride", depth: "deep focus, environment in full detail" },
  { camera: "high-angle shot from above, overhead perspective", moment: "relaxed and unaware, candid street photography style", depth: "wide focus, full environment context" },
  { camera: "close-up medium shot focusing on upper body", moment: "subtle expression, looking slightly off-camera", depth: "very shallow DOF, background heavily bokeh" },
  { camera: "wide shot showing full body and surroundings", moment: "exploring the space, interactive with environment", depth: "balanced focus between subject and setting" },
  { camera: "over-the-shoulder composition, side profile", moment: "turning, transitional movement", depth: "background in soft focus" },
  { camera: "three-quarter angle from the right, slightly low", moment: "spontaneous laugh or smile, authentic emotion", depth: "cinematic depth, foreground elements framing subject" },
];

const LIGHTING_VARIATIONS = [
  "cinematic golden hour lighting with warm tones",
  "soft diffused studio lighting, clean and professional",
  "dramatic side lighting with deep shadows (chiaroscuro)",
  "cool blue-toned overcast natural daylight",
  "neon-accented night lighting, vibrant color contrast",
  "backlit silhouette with a glowing rim light effect",
  "warm candlelight or lantern-style intimate lighting",
  "bright midday sunlight, high-key and fresh look",
];

// Helper untuk memilih item acak dari array
const randomPick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Helper untuk memastikan tidak memilih item yang sama dua kali berturut-turut
const randomPickExcluding = <T>(arr: T[], exclude: T): T => {
  const filtered = arr.filter(item => item !== exclude);
  return filtered[Math.floor(Math.random() * filtered.length)];
};

// Helper khusus untuk SCENE_SUB_VARIATIONS berdasarkan index
const randomSceneVariation = (excludeIdx: number): { variation: typeof SCENE_SUB_VARIATIONS[0]; idx: number } => {
  const available = SCENE_SUB_VARIATIONS.map((v, i) => i).filter(i => i !== excludeIdx);
  const idx = available[Math.floor(Math.random() * available.length)];
  return { variation: SCENE_SUB_VARIATIONS[idx], idx };
};


// ============================================================
// FUNGSI DETEKSI GENDER
// ============================================================
export async function detectImageGender(
  base64Data: string,
  mimeType: string
): Promise<'pria' | 'wanita' | null> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const prompt = `
    Lihat gambar ini. Apakah subjek manusia UTAMA dalam gambar ini terlihat seperti Laki-laki (Male) atau Perempuan (Female)?
    
    Jawab HANYA dengan satu kata:
    - "pria" (jika laki-laki)
    - "wanita" (jika perempuan)
    - "unknown" (jika tidak ada manusia atau tidak jelas)
    
    Jangan tambahkan teks lain.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: prompt }
        ]
      }
    });

    const text = response.text?.trim().toLowerCase();
    if (text === 'pria') return 'pria';
    if (text === 'wanita') return 'wanita';
    return null;
  } catch (error) {
    console.error("Error detecting gender:", error);
    return null;
  }
}


// ============================================================
// FUNGSI GENERATE VIDEO PROMPT (VEO 3)
// ============================================================
export async function generateVeo3VideoPrompt(
  image: { data: string; mimeType: string },
  sceneDescription: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const systemInstruction = `
Your task is to create an optimal, cinematic, and realistic Veo 3 prompt based on the provided image and scene description.
The prompt you generate must be written in English and follow a descriptive format suitable for Veo 3.

**INPUTS:**
1.  **Image:** A static image representing the scene.
2.  **Scene Description:** "${sceneDescription}"

**YOUR PROMPT MUST INCLUDE THE FOLLOWING, formatted as a natural, descriptive paragraph:**
1.  **Subject and Action:** Explain the main subject and their primary action.
2.  **Scene/Environment:** Explain the scene/environment where the action takes place.
3.  **Camera Movement & Angle:** Explain the camera movement and viewpoint (e.g., "low-angle shot," "slowly panning left").
4.  **Lighting & Mood:** Explain the lighting and the overall mood of the video.
5.  **Visual Styles:** Add the following styles at the end of the prompt: "cinematic, realistic, 4K quality, natural motion."

**OUTPUT RULES:**
- Provide ONLY the final prompt string. Do not include any explanations, labels, or markdown formatting.
`;

  try {
    const contents: { parts: Part[] } = {
      parts: [
        {
          inlineData: {
            data: image.data,
            mimeType: image.mimeType,
          }
        },
        { text: systemInstruction }
      ]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    });

    const videoPrompt = response.text?.trim();

    if (!videoPrompt) {
      throw new Error("AI did not return a Veo 3 video prompt.");
    }

    return videoPrompt;

  } catch (error: any) {
    console.error("Error calling Gemini for Veo 3 video prompt generation:", error);
    let errorMessage = "Gagal membuat prompt video Veo 3.";
    if (error.message) {
      errorMessage += ` Pesan: ${error.message}`;
    }
    throw new Error(errorMessage);
  }
}


// ============================================================
// FUNGSI GENERATE VIDEO PROMPT (BAHASA INDONESIA)
// ============================================================
export async function generateVideoPrompt(
  image: { data: string; mimeType: string },
  originalPrompt: string,
  focusItem?: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const systemInstruction = `
Anda adalah seorang Sutradara Kreatif ahli yang bertugas membuat prompt untuk AI Video Generator (seperti Luma, Kling, atau Runway).
Tugas Anda adalah menganalisis gambar statis yang diberikan dan menuliskan sebuah naskah visual (video prompt) dalam BAHASA INDONESIA yang akan menghidupkan gambar tersebut secara sinematik.

STRUKTUR PROMPT VIDEO YANG WAJIB ANDA IKUTI:
1.  **Gerakan Kamera & Mood:** Deskripsikan gerakan kamera yang unik dan variatif (contoh: "Kamera melakukan tracking shot perlahan...", "Dolly zoom dramatis ke arah...", "Panning cinematic dari bawah ke atas...", "Low angle shot yang memberikan kesan megah..."). Sesuaikan dengan komposisi gambar.
2.  **Subjek dan Aksi Kreatif:** Jelaskan aksi model atau objek utama yang bervariasi dan DINAMIS. JANGAN hanya "tersenyum". Tambahkan aksi mikro yang realistis (contoh: "...model menyisir rambut ke belakang telinga...", "...berjalan dengan percaya diri sambil membetulkan kerah baju...", "...menatap tajam ke kamera lalu menoleh perlahan...", "...tertawa kecil sambil menutup mulut..."). 
    ${focusItem ? `**PENTING:** Fokuskan aksi pada "${focusItem}". (Contoh: "Kamera zoom in ke arah ${focusItem} saat tangan model menyentuhnya...")` : ''}
3.  **Ekspresi & Emosi:** Deskripsikan emosi yang spesifik pada wajah model sesuai suasana gambar (contoh: "ekspresi misterius", "senyum ramah yang tulus", "tatapan intens dan menggoda").
4.  **Latar Belakang & Atmosfer:** Sebutkan interaksi dengan latar belakang atau elemen sekitar (contoh: "...angin sepoi-sepoi menggerakkan rambut dan dedaunan di latar belakang...", "...lampu kota di background berkedip lembut (bokeh)...").
5.  **Pencahayaan & Visual:** Tutup dengan pencahayaan (contoh: "Golden hour lighting", "Neon lighting contrast", "Soft diffused light").

**CONTOH FORMAT OUTPUT:**
"Kamera bergerak perlahan (slow pan) mengelilingi model, menangkap detail tekstur pakaian. Model tersenyum tipis sambil menatap kejauhan, lalu menoleh ke arah lensa dengan tatapan tajam. Angin lembut menerpa rambutnya, menciptakan gerakan natural. Pencahayaan warm sunset menciptakan siluet yang estetik dan dramatis."

**ATURAN KHUSUS:**
- JANGAN gunakan kata "gambar ini" atau "foto ini". Langsung deskripsikan adegannya.
- Hasilkan HANYA satu paragraf prompt dalam Bahasa Indonesia.
- Buatlah terasa "hidup" dan "mahal".
`;

  try {
    const contents: { parts: Part[] } = {
      parts: [
        {
          inlineData: {
            data: image.data,
            mimeType: image.mimeType,
          }
        },
        { text: systemInstruction }
      ]
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
    });

    const videoPrompt = response.text?.trim();
    return videoPrompt || "Kamera melakukan tracking shot halus mengikuti gerakan model yang berpose anggun dengan ekspresi menawan, pencahayaan sinematik yang indah.";

  } catch (error: any) {
    console.error("Error generating dynamic video prompt:", error);
    return "Kamera bergerak perlahan menciptakan kedalaman visual, model berpose natural dengan ekspresi yang kuat, pencahayaan estetik.";
  }
}


// ============================================================
// FUNGSI GENERATE TEXT-TO-VIDEO PROMPT
// ============================================================
export async function generateTextToVideoPrompt(
  sceneDescription: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const systemInstruction = `
You are an expert video prompt creator for AI text-to-video generators. Your task is to transform a simple scene description from a script into a rich, detailed, and cinematic video prompt in ENGLISH.

**INSTRUCTIONS:**
1.  **Analyze the Scene:** Read the provided scene description in Indonesian.
2.  **Compose a Detailed Prompt:** Write a single, comprehensive paragraph in ENGLISH.
3.  **Incorporate Subject, Action, Environment, Mood, Lighting, and Camera Movement.**
4.  **Output:** Provide ONLY the final prompt string in English.
`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemInstruction}\n\nSCENE: ${sceneDescription}`,
    });
    return response.text?.trim() || "";
  } catch (error: any) {
    console.error("Error calling Gemini for text-to-video prompt generation:", error);
    throw new Error("Gagal membuat prompt text-to-video.");
  }
}


// ============================================================
// FUNGSI GENERATE IMAGE (dengan/tanpa referensi)
// ============================================================
export async function generateImage(
  prompt: string,
  aspectRatio: AspectRatio,
  referenceImage?: { data: string; mimeType: string },
  referenceMode?: ReferenceMode
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt gambar kosong. Tidak dapat membuat gambar.");
  }

  try {
    if (!referenceImage) {
      let apiAspectRatio = aspectRatio;
      if (aspectRatio === '2:3' || aspectRatio === '4:5') {
        apiAspectRatio = '3:4';
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: apiAspectRatio,
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
      throw new Error("AI tidak mengembalikan data gambar.");
    }
    else {
      let finalPrompt = "";

      let apiAspectRatio = aspectRatio;
      if (aspectRatio === '2:3' || aspectRatio === '4:5') {
        apiAspectRatio = '3:4';
      }

      if (referenceMode === 'kreatif') {
        finalPrompt = `
        TASK: Creative Scene Generation with Face Identity Lock.
        
        INPUT REFERENCE: Contains the "Actor".
        SCENE PROMPT: "${prompt}"
        
        INSTRUCTIONS:
        1. IF SCENE REQUIRES A PERSON:
           - LOCK FACE/IDENTITY: Use the exact face from the reference image.
           - CHANGE OUTFIT: Generate NEW CLOTHING suitable for the scene described. Do NOT use the reference outfit.
           - CHANGE BACKGROUND & POSE: Create a new environment and pose matching the scene.
           
        2. IF SCENE IS AN OBJECT/SCENERY (No Person):
           - IGNORE the reference image content entirely. Just generate the scene described.
           
         Aspect Ratio: ${apiAspectRatio}. Style: Photorealistic.
        `;
      } else {
        finalPrompt = `
        TASK: Scene Recontextualization with Character Lock.
        
        INPUT REFERENCE: Contains the "Actor" and "Outfit".
        SCENE PROMPT: "${prompt}"
        
        INSTRUCTIONS:
        1. IF SCENE REQUIRES A PERSON:
           - LOCK FACE/IDENTITY: Use the exact face from the reference.
           - LOCK OUTFIT: Use the EXACT clothing/outfit from the reference.
           - CHANGE BACKGROUND & POSE: Place this character in the new environment/pose described.
           
        2. IF SCENE IS AN OBJECT/SCENERY (No Person):
           - IGNORE the reference image content entirely. Just generate the scene described.

        Aspect Ratio: ${apiAspectRatio}. Style: Photorealistic.
        `;
      }

      const contents: { parts: Part[] } = {
        parts: [
          { inlineData: { data: referenceImage.data, mimeType: referenceImage.mimeType } },
          { text: finalPrompt }
        ]
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contents,
        config: {
          imageConfig: {
            aspectRatio: apiAspectRatio,
          }
        },
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
      throw new Error("Gagal menghasilkan gambar dengan referensi.");
    }
  } catch (error: any) {
    console.error("Error in generateImage:", error);
    let msg = error.message;
    if (msg.includes("Empty instances") || msg.includes("INVALID_ARGUMENT")) {
      msg = "Parameter gambar tidak valid atau prompt kosong.";
    }
    throw new Error(msg);
  }
}


// ============================================================
// FUNGSI SMART EDIT IMAGE
// ============================================================
export async function smartEditImage(
  base64Data: string,
  mimeType: string,
  targetAspectRatio: AspectRatio,
  editInstruction: string = ""
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const prompt = `Fill all void spaces (black areas) to achieve strictly ${targetAspectRatio} ratio seamlessly. Preserve subject identity and pose perfectly. ${editInstruction}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: targetAspectRatio,
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return part.inlineData.data;
      }
    }
    throw new Error("Failed to edit image.");
  } catch (error) {
    console.error("Smart Edit Error", error);
    throw error;
  }
}


// ============================================================
// FUNGSI GENERATE CHARACTER SESSION
// ============================================================
export async function generateCharacterSession(formData: CharacterFormData): Promise<CharacterResult> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const regionText = formData.region === 'others' ? formData.customRegion : MODEL_REGIONS.find(r => r.id === formData.region)?.label;
  const framingText = CHARACTER_FRAMINGS.find(f => f.id === formData.framing)?.prompt || "Medium shot";

  const prompt = `
    Anda adalah AI Prompt Engineer untuk Image Generation (Midjourney/Flux/Stable Diffusion).
    
    INPUT DATA KARAKTER:
    - Region/Etnis: ${regionText}
    - Gender: ${formData.gender}
    - Umur: ${formData.age}
    - Deskripsi User: "${formData.userDescription || '-'}"
    - Framing/Shot: ${framingText}
    - Style: ${formData.genre}
    
    TUGAS:
    1. Buat deskripsi karakter (Summary) dalam Bahasa Indonesia yang merangkum visual karakter ini.
    2. Buat PROMPT A (Portrait/Front View) dalam BAHASA INGGRIS. Detail, lighting cinematic, photorealistic (sesuai style). Fokus pada wajah dan framing yang diminta.
    3. Buat PROMPT B (Action/Side View) dalam BAHASA INGGRIS. Karakter yang sama, tapi angle berbeda atau sedang melakukan aktivitas natural.
    
    FORMAT OUTPUT JSON:
    {
      "summary": "Deskripsi singkat karakter...",
      "promptA": "Prompt bahasa inggris untuk shot utama...",
      "promptB": "Prompt bahasa inggris untuk shot kedua..."
    }
    
    Negative Prompts (masukkan dalam prompt jika perlu): ugly, deformed, noisy, blurry, distorted.
    `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const result = JSON.parse(response.text || "{}");

    return {
      id: `char_${Date.now()}`,
      summary: result.summary,
      promptA: result.promptA,
      promptB: result.promptB,
      isLoadingA: false,
      isLoadingB: false,
      timestamp: Date.now()
    };

  } catch (error: any) {
    console.error("Error generating character prompts:", error);
    throw new Error("Gagal membuat prompt karakter.");
  }
}


// ============================================================
// FUNGSI GENERATE CREATIVE IMAGE PROMPTS
// ============================================================
export async function generateCreativeImagePrompts(formData: PromptMakerFormData): Promise<PromptMakerResult> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const prompt = `
    Anda adalah Prompt Engineer Expert.
    
    INPUT:
    - Ide Dasar: "${formData.idea}"
    - Genre/Style: ${formData.genre}
    - Angle Kamera: ${formData.angle}
    
    TUGAS:
    1. Buat "indoPrompt": Deskripsi scene yang artistik dan detail dalam Bahasa Indonesia.
    2. Buat "engPrompt": Prompt final dalam Bahasa Inggris yang sangat detail untuk AI Image Generator (seperti Midjourney). Masukkan detail lighting, texture, camera lens, color grading, dan composition.
    
    FORMAT OUTPUT JSON:
    {
      "indoPrompt": "...",
      "engPrompt": "..."
    }
    `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    const result = JSON.parse(response.text || "{}");

    return {
      id: `prompt_${Date.now()}`,
      idea: formData.idea,
      indoPrompt: result.indoPrompt,
      engPrompt: result.engPrompt,
      timestamp: Date.now()
    };

  } catch (error: any) {
    console.error("Error creating prompts:", error);
    throw new Error("Gagal membuat prompt.");
  }
}


// ============================================================
// HELPER: Bangun blok instruksi face-lock yang kuat
// ============================================================
const buildFaceLockInstructions = (refIndex: number): string => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FACE & IDENTITY LOCK — ABSOLUTE PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The face in Reference ${refIndex} is the SINGLE SOURCE OF TRUTH for identity.
You MUST replicate ALL of the following with 100% accuracy:

  • Facial structure & proportions (oval/square/heart/round shape)
  • Skin tone & undertone (warm/cool/neutral, exact shade)
  • Eye shape, size, color, and lid fold
  • Nose shape: bridge width, tip, nostril form
  • Lip shape: upper bow, lower fullness, corner position
  • Eyebrow arch, thickness, color
  • Jawline & chin definition
  • Cheekbone prominence
  • Any unique marks, dimples, or distinguishing features

FORBIDDEN ALTERATIONS:
  ✗ Do NOT beautify, idealize, or smooth the face beyond natural lighting.
  ✗ Do NOT change skin tone even slightly.
  ✗ Do NOT alter eye shape, color, or spacing.
  ✗ Do NOT change nose or lip proportions.
  ✗ Do NOT age up or de-age the subject.
  ✗ Do NOT merge or blend this face with any other face.

VERIFICATION: The output face must be instantly recognizable
as the EXACT same person from Reference ${refIndex} by any observer.
If identity cannot be perfectly preserved, FACE ACCURACY takes
priority over all other instructions including pose and background.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

// ============================================================
// HELPER: Bangun blok instruksi pose-lock
// ============================================================
const buildPoseLockInstructions = (refIndex: number): string => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POSE & POSTURE LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Replicate the body posture from Reference ${refIndex} with high fidelity:

  • Overall stance & body orientation (facing angle, weight distribution)
  • Head tilt and neck angle
  • Shoulder alignment (level, raised, dropped)
  • Arm position, elbow bend, and hand/wrist pose
  • Hip angle and leg stance (width, bend, crossing)
  • If seated/crouching, replicate the degree of bend
  • Preserve any expressive micro-gestures (hand gesture, finger position)

FORBIDDEN:
  ✗ Do NOT substitute with a completely different pose.
  ✗ Minor camera angle or framing adjustments are allowed,
    but the body configuration must remain the same.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;


// ============================================================
// HELPER: Bangun blok instruksi product-lock yang kuat
// ============================================================
const buildProductLockInstructions = (
  refIndex: number,
  userDesc?: string
): string => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUCT FIDELITY LOCK — HIGH PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The product in Reference ${refIndex} must be reproduced with MAXIMUM accuracy.
Treat it like a product photography retouching task — every detail matters.

VISUAL ELEMENTS TO PRESERVE 100%:
  • Overall shape & silhouette (bottle, box, tube, can, bag, etc.)
  • Exact dimensions & proportions relative to the human subject
  • All colors — primary body color, accent colors, gradients
  • Surface material & finish (matte, glossy, metallic, transparent, etc.)
  • Brand name / logo: exact font style, size, position, color
  • Label design: layout, illustrations, icons, text blocks
  • Any printed text: ingredients, taglines, URLs — preserve placement
  • Lid / cap / closure: shape, color, material
  • Any special features: embossing, cutouts, handles, straps, zippers
${userDesc ? `
USER DESCRIPTION (use this as additional reference for accuracy):
"${userDesc}"
Cross-check every detail above against this description.` : ''}

FORBIDDEN ALTERATIONS:
  ✗ Do NOT change the brand name or logo — not even slightly.
  ✗ Do NOT alter the shape or proportions of the product.
  ✗ Do NOT change any colors on the product.
  ✗ Do NOT remove or rewrite any text on the label.
  ✗ Do NOT substitute with a generic/similar product.
  ✗ Do NOT shrink or enlarge the product unrealistically.

SMART PLACEMENT — Choose the most natural interaction:
  • WEARABLE (clothing, hat, sunglasses, bag, shoes, watch, jewelry, belt, scarf)
    → Subject WEARS it. Correct position on body, fits naturally, follows body contours.

  • HANDHELD (phone, bottle, cup, book, paper, camera, small gadget)
    → Subject HOLDS it in one hand. Clearly visible to camera, natural grip.

  • SHOWCASE (large product, boxed item, poster, food dish, framed item)
    → Subject PRESENTS, HOLDS UP, or GESTURES TOWARD it.
      Product must be prominent in frame, not obstructed.

QUALITY CHECK: A viewer must be able to identify the exact product
from the output image without seeing the reference.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
export async function generateAdvancedImages(
  formData: AdvancedImageFormData
): Promise<AdvancedImageResult[]> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const results: AdvancedImageResult[] = [];
  const baseFilename = formData.filename || `gen_${Date.now()}`;

  const hasReference = formData.refModel || formData.refTop || formData.refBottom || formData.refProduct;
  const lockPose = formData.poseMode === 'lock' && !!formData.refModel;

  // Simpan pilihan sebelumnya agar tidak terulang berturut-turut
  let lastSceneIdx = -1;
  let lastLighting = "";

  let apiAspectRatio = formData.aspectRatio;
  if (formData.aspectRatio === '2:3' || formData.aspectRatio === '4:5') {
    apiAspectRatio = '3:4';
  }

  for (let i = 0; i < formData.count; i++) {
    let base64 = "";

    // -------------------------------------------------------
    // PILIH VARIASI KOMPOSISI — bervariasi DALAM lokasi dari prompt user
    // Jika user pilih framing tertentu → pakai itu, kalau 'auto' → acak
    // -------------------------------------------------------
    const { variation: currentScene, idx: currentSceneIdx } = randomSceneVariation(lastSceneIdx);

    // Tentukan camera string + crop rule berdasarkan pilihan user
    const userFraming = formData.framing && formData.framing !== 'auto' ? formData.framing : null;

    const FRAMING_CAMERA_MAP: Record<string, { camera: string; crop: string }> = {
      close_up: {
        camera: 'close-up portrait shot, face and shoulders only, subject fills the frame',
        crop:   'CROP: Show ONLY face, neck, and shoulders. DO NOT show chest, torso, arms, or legs.',
      },
      medium: {
        camera: 'medium shot from waist up, subject visible from waist to head',
        crop:   'CROP: Show subject from WAIST UP only. DO NOT show hips, legs, or feet. Cut frame at waist level.',
      },
      full_body: {
        camera: 'full body shot, subject visible from head to toe',
        crop:   'CROP: Show the COMPLETE body from head to feet. Entire figure must be in frame.',
      },
      wide: {
        camera: 'wide establishing shot, subject and surroundings both visible',
        crop:   'CROP: Wide frame showing subject AND their environment. Subject takes up roughly 1/3 of frame height.',
      },
    };

    const framingRule = userFraming && FRAMING_CAMERA_MAP[userFraming]
      ? FRAMING_CAMERA_MAP[userFraming]
      : { camera: currentScene.camera, crop: '' };

    const effectiveCamera = framingRule.camera;
    const effectiveCrop   = framingRule.crop;

    // Pose hint yang disesuaikan dengan framing
    // Jika close_up atau medium → hindari pose yang butuh full body
    const poseHintsByFraming: Record<string, string[]> = {
      close_up: [
        "subtle head tilt, soft expression",
        "looking slightly off-camera with a gentle smile",
        "chin slightly down, eyes forward, intimate feel",
        "natural relaxed expression, face fills the frame",
      ],
      medium: [
        "hands clasped naturally in front, relaxed upper body",
        "one hand resting on hip, confident pose",
        "arms relaxed at sides, natural shoulder posture",
        "leaning slightly toward camera, engaged expression",
        "arms crossed loosely, casual upper body pose",
        "one hand touching chin thoughtfully",
        "shoulders turned slightly to the side, three-quarter pose",
        "natural open arms gesture, upper body engaged",
      ],
      full_body: [
        "a relaxed, natural standing pose",
        "a candid walking pose, mid-stride",
        "a casual leaning pose against a surface",
        "a subtle turning or looking-away pose",
        "an expressive, engaged pose interacting with surroundings",
        "a confident, poised pose facing the camera",
        "a side-profile or three-quarter body pose",
        "sitting or perching naturally on a surface",
      ],
      wide: [
        "a natural pose that feels candid and environmental",
        "walking through the space naturally",
        "interacting with the surroundings",
        "standing and looking at something in the scene",
      ],
    };

    const hintList = userFraming && poseHintsByFraming[userFraming]
      ? poseHintsByFraming[userFraming]
      : poseHintsByFraming['full_body'];
    const poseVariationHint = hintList[i % hintList.length];

    // ── Lighting & tracking ──
    const currentLighting = lastLighting
      ? randomPickExcluding(LIGHTING_VARIATIONS, lastLighting)
      : randomPick(LIGHTING_VARIATIONS);

    lastSceneIdx = currentSceneIdx;
    lastLighting = currentLighting;

    // storedPrompt: yang akan disimpan ke history & file .txt
    // berisi prompt asli + keterangan pose/bg/lighting yang dipakai
    let storedPrompt = "";

    try {
      // -------------------------------------------------------
      // TANPA REFERENSI GAMBAR
      // -------------------------------------------------------
      if (!hasReference) {
        const variedPrompt = `
${effectiveCrop ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRAMING RULE — ABSOLUTE, NON-NEGOTIABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Camera type: ${effectiveCamera}
${effectiveCrop}
This framing rule overrides everything else. Render EXACTLY this crop.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

` : ''}${formData.prompt}

COMPOSITION (apply within the scene/location above — do NOT change the location):
- Lighting style: ${currentLighting}
- Depth of field: ${currentScene.depth}
- Pose: Choose a pose APPROPRIATE for the framing "${effectiveCamera}".
  Use "${poseVariationHint}" as direction — ONLY if it suits the framing and scene.
  NEVER choose a pose that conflicts with the framing (e.g. no walking pose for close-up or medium shot).
- IMPORTANT: Location MUST match the scene description. Do NOT substitute the location.
- This is image ${i + 1} of ${formData.count} — make it visually DISTINCT from the others.
- Photo quality: ultra-realistic, high-detail, professional photography, sharp focus.
        `.trim();

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: [{ text: variedPrompt }] },
          config: {
            imageConfig: {
              aspectRatio: apiAspectRatio,
            }
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData && part.inlineData.data) {
            base64 = part.inlineData.data;
            break;
          }
        }

        // Simpan variedPrompt agar download .txt mencatat variasi komposisi yang dipakai
        storedPrompt = `${formData.prompt}

[Variasi komposisi yang dipakai — Gambar ${i + 1}]
- Framing/Kamera: ${userFraming ? userFraming.replace('_', ' ') : 'Auto — ' + currentScene.camera}
- Pose: Kontekstual (dipilih AI sesuai scene), arah: "${poseVariationHint}"
- Momen: ${currentScene.moment}
- Depth of field: ${currentScene.depth}
- Lighting: ${currentLighting}
Catatan: Lokasi/background mengikuti deskripsi prompt di atas.`;
      }
      // -------------------------------------------------------
      // DENGAN REFERENSI GAMBAR
      // -------------------------------------------------------
      else {
        const parts: Part[] = [];

        // ── Tentukan urutan index referensi ──
        let refIdx = 1;
        const refModelIdx   = formData.refModel   ? refIdx++ : null;
        const refTopIdx     = formData.refTop      ? refIdx++ : null;
        const refBottomIdx  = formData.refBottom   ? refIdx++ : null;
        const refProductIdx = formData.refProduct  ? refIdx++ : null;

        // ── Kirim gambar referensi TERLEBIH DAHULU ke API ──
        if (formData.refModel)   parts.push({ inlineData: { data: formData.refModel.data,   mimeType: formData.refModel.mimeType   } });
        if (formData.refTop)     parts.push({ inlineData: { data: formData.refTop.data,     mimeType: formData.refTop.mimeType     } });
        if (formData.refBottom)  parts.push({ inlineData: { data: formData.refBottom.data,  mimeType: formData.refBottom.mimeType  } });
        if (formData.refProduct) parts.push({ inlineData: { data: formData.refProduct.data, mimeType: formData.refProduct.mimeType } });

        // ── Bangun keterangan referensi ──
        const refListText = [
          formData.refModel   && `[Reference ${refModelIdx}  — MAIN SUBJECT / FACE IDENTITY SOURCE]`,
          formData.refTop     && `[Reference ${refTopIdx}    — TOP GARMENT]`,
          formData.refBottom  && `[Reference ${refBottomIdx} — BOTTOM GARMENT]`,
          formData.refProduct && `[Reference ${refProductIdx}— FEATURED PRODUCT]`,
        ].filter(Boolean).join('\n');

        // ── Face lock (selalu aktif jika ada refModel) ──
        const faceLockBlock = formData.refModel
          ? buildFaceLockInstructions(refModelIdx!)
          : '';

        // ── Gender detection dari referensi ──
        // Instruksikan AI membaca gender dari foto referensi, lalu sesuaikan
        // pakaian & aksesoris agar cocok — termasuk preset yang mungkin menyebut
        // gender tertentu (misal "berhijab") harus diabaikan jika subjek laki-laki.
        const genderBlock = formData.refModel ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENDER — AUTO-DETECT FROM REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Look at Reference ${refModelIdx} and determine the subject's gender.
Then apply gender-appropriate clothing and accessories for the scene:

  IF SUBJECT IS MALE:
    • Dress in male-appropriate outfit for the scene (baju koko, kemeja, jas, dll)
    • Do NOT add hijab, jilbab, or any female-specific garment
    • Apply male grooming and styling appropriate for the scene

  IF SUBJECT IS FEMALE:
    • Dress in female-appropriate outfit for the scene
    • If scene context is Islamic (Islami/Muslim), add hijab/kerudung naturally
    • Apply female styling appropriate for the scene

IMPORTANT: The scene prompt may contain gender-specific words written generically
(e.g. "berpakaian muslim elegan"). Interpret them based on the ACTUAL gender
detected from the reference photo — do NOT force a female interpretation
onto a male subject or vice versa.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : '';

        // ── Pose block ──
        const poseBlock = lockPose
          ? buildPoseLockInstructions(refModelIdx!)
          : `POSE — Contextual, Scene-Appropriate, and FRAMING-CONSISTENT:
  Choose a pose APPROPRIATE for both the scene AND the framing type "${effectiveCamera}".
  Use "${poseVariationHint}" as direction — ONLY if it suits this framing.
  NEVER choose a pose that shows more body than the framing allows
  (e.g. no walking/full-body poses for close-up or medium shot).
  Prioritize what a real person would naturally do in this environment.
  This is image ${i + 1} of ${formData.count} — vary the pose from other images.`;

        // ── Clothing block ──
        // Prioritas:
        // 1. Jika ada refTop / refBottom → selalu try-on (outfitMode diabaikan untuk bagian itu)
        // 2. Jika TIDAK ada refTop/refBottom:
        //    - outfitMode 'lock' (default) → kunci pakaian dari refModel
        //    - outfitMode 'random'         → AI bebas pilih pakaian sesuai scene
        const hasClothingRef = formData.refTop || formData.refBottom;
        const lockOutfit = !hasClothingRef && formData.outfitMode !== 'random';

        const clothingBlock = hasClothingRef
          ? [
              // --- Try-on atasan jika ada ---
              formData.refTop && `
TOP GARMENT TRY-ON (Reference ${refTopIdx}):
  • Remove whatever top/shirt/jacket the subject is currently wearing.
  • Dress the subject in the EXACT garment shown in Reference ${refTopIdx}.
  • Preserve all details: fabric texture, color, pattern, cut, collar, sleeves, and buttons.
  • The garment must fit naturally on the subject's body — follow body contours, wrinkle naturally, obey gravity.
  • Do NOT alter the garment's design even slightly.`,

              // --- Try-on bawahan jika ada ---
              formData.refBottom && `
BOTTOM GARMENT TRY-ON (Reference ${refBottomIdx}):
  • Remove whatever bottom/pants/skirt the subject is currently wearing.
  • Dress the subject in the EXACT garment shown in Reference ${refBottomIdx}.
  • Preserve all details: fabric texture, color, pattern, cut, waistband, and hem length.
  • The garment must fit naturally — follow body contours, wrinkle/drape realistically.
  • Do NOT alter the garment's design even slightly.`,

              // --- Bagian yang TIDAK ada referensinya: pertahankan dari refModel ---
              !formData.refTop    && formData.refModel && `TOP (no reference provided): Keep the EXACT top/shirt the subject wears in Reference ${refModelIdx}. Do NOT change it.`,
              !formData.refBottom && formData.refModel && `BOTTOM (no reference provided): Keep the EXACT bottom/pants the subject wears in Reference ${refModelIdx}. Do NOT change it.`,
            ].filter(Boolean).join('\n')
          : lockOutfit
            ? `
OUTFIT LOCK — Preserve outfit from reference:
  • Keep the COMPLETE outfit worn by the subject in Reference ${refModelIdx} EXACTLY as-is.
  • This includes: top, bottom, outerwear, shoes, accessories, and any layering.
  • Do NOT change, replace, or alter ANY clothing item.
  • Only the background, lighting, and ${lockPose ? 'camera angle' : 'pose and background'} may change.`
            : `
OUTFIT FREE — AI may choose outfit:
  • You are FREE to dress the subject in any outfit appropriate for the scene described.
  • Choose clothing that matches the mood, setting, and style of the scene prompt.
  • Be creative — vary the outfit style while keeping it realistic and tasteful.
  • Ignore the outfit from the reference image entirely.`;

        // ── Product block — pakai helper buildProductLockInstructions ──
        const productBlock = formData.refProduct
          ? buildProductLockInstructions(refProductIdx!, formData.refProductDesc)
          : '';

        const masterPrompt = `
TASK: Generate a high-fidelity, photorealistic image with strict identity and style preservation.
${effectiveCrop ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FRAMING RULE — ABSOLUTE, NON-NEGOTIABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Camera type: ${effectiveCamera}
${effectiveCrop}
This framing rule overrides all other instructions about body visibility.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}
══════════════════════════════════════════
REFERENCE IMAGES PROVIDED (${parts.length} images):
${refListText}
══════════════════════════════════════════

SCENE TO GENERATE:
"${formData.prompt}"

${faceLockBlock}

${genderBlock}

══════════════════════════════════════════
POSE & BODY
══════════════════════════════════════════
${poseBlock}

══════════════════════════════════════════
CLOTHING
══════════════════════════════════════════
${clothingBlock || 'No specific clothing reference — generate appropriate attire for the scene.'}

══════════════════════════════════════════
PRODUCT / PROP
══════════════════════════════════════════
${productBlock || 'No product reference.'}

══════════════════════════════════════════
ENVIRONMENT & TECHNICAL
══════════════════════════════════════════
LOCATION/BACKGROUND:
  • The location and environment MUST follow the "SCENE TO GENERATE" description above.
  • Do NOT replace the location with something else. Stay in the described setting.
  • Background must NOT come from any reference image — generate a new environment
    that matches the scene description.

COMPOSITION (vary within the described location — NOT a new location):
  • Lighting: ${currentLighting}
  • Depth of field: ${currentScene.depth}

QUALITY    : Ultra-realistic, professional photography, sharp focus, 4K detail.
UNIQUENESS : Vary camera angle, framing, and lighting — but STAY in the same described location.
ASPECT RATIO: ${apiAspectRatio}

FINAL CHECK:
✓ Face matches Reference ${refModelIdx ?? 'N/A'} exactly
✓ Gender detected from reference — outfit is gender-appropriate
${lockPose
  ? `✓ Pose matches Reference ${refModelIdx ?? 'N/A'} exactly`
  : `✓ Pose is natural and appropriate for the scene (hint: "${poseVariationHint}")`}
${hasClothingRef
  ? `✓ Try-on applied: ${[formData.refTop && 'TOP from Ref '+refTopIdx, formData.refBottom && 'BOTTOM from Ref '+refBottomIdx].filter(Boolean).join(' + ')}`
  : lockOutfit
    ? `✓ Outfit locked from Reference ${refModelIdx} — unchanged`
    : `✓ Outfit is FREE — chosen to match the scene`}
${formData.refProduct ? `✓ Product from Reference ${refProductIdx} is clearly visible (worn / held / displayed as appropriate)` : ''}
✓ Location matches the scene description — NOT replaced by a random background
✓ Image is sharp, professional, and photorealistic
        `.trim();

        parts.push({ text: masterPrompt });

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio: apiAspectRatio,
            }
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData && part.inlineData.data) {
            base64 = part.inlineData.data;
            break;
          }
        }

        // Simpan ringkasan prompt yang readable (bukan masterPrompt penuh yang sangat panjang)
        storedPrompt = `${formData.prompt}

[Variasi komposisi yang dipakai — Gambar ${i + 1}]
- Framing/Kamera: ${userFraming ? userFraming.replace('_', ' ') : 'Auto — ' + currentScene.camera}
- Pose: ${lockPose ? 'Dikunci dari referensi' : `Kontekstual (dipilih AI sesuai scene), arah: "${poseVariationHint}"`}
- Momen: ${currentScene.moment}
- Depth of field: ${currentScene.depth}
- Lighting: ${currentLighting}
- Pakaian: ${hasClothingRef ? [formData.refTop && 'Try-on Atasan', formData.refBottom && 'Try-on Bawahan'].filter(Boolean).join(' + ') : lockOutfit ? 'Dikunci dari Model Utama' : 'Bebas (sesuai scene)'}
- Produk: ${formData.refProduct ? `Ada referensi${formData.refProductDesc ? ` — "${formData.refProductDesc}"` : ' (tanpa deskripsi)'}` : '-'}
- Referensi: ${[formData.refModel && 'Model Utama', formData.refTop && 'Atasan', formData.refBottom && 'Bawahan', formData.refProduct && 'Produk'].filter(Boolean).join(', ')}`.trim();
      }

      if (!base64) throw new Error("No image data returned from AI.");

      // -------------------------------------------------------
      // GENERATE VIDEO PROMPT
      // -------------------------------------------------------
      let videoPrompt = "";
      try {
        videoPrompt = await generateVideoPrompt(
          { data: base64, mimeType: 'image/png' },
          formData.prompt,
          formData.focusItem
        );
      } catch (e) {
        console.warn("Video prompt generation failed for image", i + 1, e);
      }

      results.push({
        id: `adv_${Date.now()}_${i}`,
        filename: `${baseFilename}_${i + 1}`,
        base64: base64,
        prompt: storedPrompt,   // ← menyimpan prompt lengkap seperti aslinya
        videoPrompt: videoPrompt,
        isLoadingVideoPrompt: false,
        timestamp: Date.now(),
        aspectRatio: formData.aspectRatio
      });

    } catch (err: any) {
      console.error(`Failed to generate image ${i + 1}:`, err);
      // Kalau hanya 1 gambar yang diminta, lempar error langsung
      if (formData.count === 1) {
        throw new Error(err.message || "Gagal generate gambar.");
      }
      // Kalau banyak gambar, lanjutkan ke iterasi berikutnya
    }
  }

  return results;
}


// ============================================================
// HELPER: Hitung proporsi tinggi berdasarkan usia
// ============================================================
const getHeightProportion = (age: number): string => {
  if (age === 0)  return 'newborn infant — must be carried in arms by an adult, do NOT show standing';
  if (age <= 2)   return 'toddler ~45-50% of adult height — very small, barely reaches adult knee/hip, can be held or standing';
  if (age <= 4)   return '~55% of adult height — small child, reaches about adult waist level';
  if (age <= 6)   return '~60% of adult height — young child, reaches about adult chest-waist level';
  if (age <= 8)   return '~65% of adult height — child, reaches about adult chest level';
  if (age <= 10)  return '~70% of adult height — child, reaches about adult shoulder level';
  if (age <= 12)  return '~75% of adult height — pre-teen, slightly below adult shoulder';
  if (age <= 14)  return '~82% of adult height — early teen';
  if (age <= 16)  return '~88% of adult height — teen, nearly adult height';
  if (age <= 17)  return '~93% of adult height — older teen, close to adult height';
  return 'full adult height (100% reference)';
};

// ============================================================
// FUNGSI GENERATE FOTO GRUP (multi karakter, max 6 orang)
// ============================================================
export async function generateGroupPhoto(
  formData: import('../types').GroupPhotoFormData
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const validPersons = formData.persons.filter(p => p.image);

  if (validPersons.length === 0) {
    throw new Error("Belum ada foto yang diupload. Upload minimal 1 foto orang.");
  }

  let apiAspectRatio: string = formData.aspectRatio;
  if (formData.aspectRatio === '2:3' || formData.aspectRatio === '4:5') apiAspectRatio = '3:4';

  const parts: Part[] = [];

  // ── Kirim semua foto referensi terlebih dahulu ──
  validPersons.forEach(p => {
    parts.push({ inlineData: { data: p.image!.data, mimeType: p.image!.mimeType } });
  });

  // ── Bangun daftar referensi + instruksi per orang ──
  const personList = validPersons.map((p, idx) => {
    const refNum = idx + 1;
    const ageNum = typeof p.age === 'number' ? p.age : 25;
    const heightDesc = getHeightProportion(ageNum);
    const label = p.label || `Orang ${refNum}`;
    return `Reference ${refNum} — "${label}", Age: ${ageNum} years old
  Height proportion: ${heightDesc}
  Face lock: MUST use the exact face, skin tone, and identity from Reference ${refNum}
  Gender: Auto-detect from Reference ${refNum} — dress this person in gender-appropriate outfit`;
  }).join('\n\n');

  // ── Gender instruction per orang ──
  const genderGroupBlock = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENDER — AUTO-DETECT PER PERSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EACH person in the group, look at their reference photo and detect their gender.
Then dress them in gender-appropriate attire that fits the scene:

  MALE persons:
    • Dress in male-appropriate outfit for the scene context
    • If scene is Islamic → baju koko, kemeja, sarung, peci (for adults)
    • If scene is formal → kemeja, jas, dasi
    • Do NOT add hijab or any female-specific garment to male persons

  FEMALE persons:
    • Dress in female-appropriate outfit for the scene context
    • If scene is Islamic → hijab/kerudung + gamis/dress muslim naturally
    • If scene is formal → dress, blazer, kebaya

  CHILDREN (age ≤ 12):
    • Dress in age-appropriate children's clothing matching the scene theme
    • Boys in Islamic scene → baju koko kecil, kopiah
    • Girls in Islamic scene → hijab anak atau pakaian muslim anak yang lucu

Each person's outfit must feel coordinated as a GROUP
(same theme/occasion) while being individually gender-correct.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  // ── Tentukan orang dewasa tertua sebagai anchor tinggi ──
  const adultAges = validPersons
    .map(p => typeof p.age === 'number' ? p.age : 25)
    .filter(a => a >= 18);
  const hasAdult = adultAges.length > 0;

  const heightAnchorNote = hasAdult
    ? `Use the tallest adult as the 100% height reference. All other proportions are RELATIVE to this person.`
    : `Arrange all persons by age — older persons should appear taller than younger ones proportionally.`;

  const FRAMING_CAMERA_MAP: Record<string, string> = {
    close_up:  'close-up portrait shot, faces and upper bodies fill the frame, intimate group framing',
    medium:    'medium group shot from waist up, all subjects clearly visible, eye-level angle',
    full_body: 'full body group shot showing all subjects from head to toe, entire figures visible',
    wide:      'wide establishing shot, group visible within their environment, showing location context',
  };
  const groupFraming = formData.framing && formData.framing !== 'auto'
    ? FRAMING_CAMERA_MAP[formData.framing]
    : 'medium group shot — all persons clearly visible, natural group framing';

  const masterPrompt = `
TASK: Generate a single, high-fidelity, photorealistic GROUP PHOTO with ${validPersons.length} people.

══════════════════════════════════════════
REFERENCE IMAGES (${validPersons.length} people):
${personList}
══════════════════════════════════════════

SCENE / LOCATION:
"${formData.scene || 'casual family photo, bright natural outdoor setting'}"

${genderGroupBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FACE LOCK — ABSOLUTE PRIORITY FOR ALL PERSONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EACH person, you MUST:
  • Reproduce their exact facial structure, skin tone, eye shape, and identity
  • Do NOT blend, merge, or swap any faces between persons
  • Each person must be instantly recognizable from their reference photo
  • Maintain unique distinguishing features (glasses, dimples, hair, etc.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HEIGHT & PROPORTIONS — CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${heightAnchorNote}

Height proportions MUST be physically accurate and immediately obvious:
  • Children must visibly be shorter than adults — this is non-negotiable
  • Infants/toddlers must be carried or held, NOT standing independently
  • Young children should only reach adult waist/chest height when standing
  • Pre-teens and teens should show gradual growth toward adult height
  • Do NOT make all people the same height

NATURAL GROUP ARRANGEMENT:
  • Position people naturally — taller/adults behind or beside, children in front
  • If someone is an infant (age 0-1), show them being held by an adult
  • Allow natural physical contact (hands on shoulders, hugging, etc.) where appropriate
  • Everyone should be clearly visible and not obscured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPOSITION & QUALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • FRAMING / SHOT TYPE: ${groupFraming}
  • All ${validPersons.length} people must be fully visible in the frame
  • Natural, warm expressions — genuine smiles or candid emotions
  • Professional photography quality: sharp focus, good exposure
  • Background matches the scene description — do NOT use reference backgrounds
  • Lighting: natural and flattering for a group photo
  • Aspect Ratio: ${apiAspectRatio}

FORBIDDEN:
  ✗ Do NOT merge any two people into one
  ✗ Do NOT make children the same height as adults
  ✗ Do NOT show infants standing on their own
  ✗ Do NOT use background from any reference photo
  ✗ Do NOT add hijab or female garments to male persons
  ✗ Do NOT dress female persons in male-only attire
  ✗ All outfits must match the scene theme AND be gender-correct per individual
  `.trim();

  parts.push({ text: masterPrompt });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { imageConfig: { aspectRatio: apiAspectRatio } }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) return part.inlineData.data;
    }
    throw new Error("AI tidak mengembalikan gambar grup.");
  } catch (error: any) {
    console.error("Error generating group photo:", error);
    throw new Error(error.message || "Gagal membuat foto grup.");
  }
}
