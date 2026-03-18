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
// VARIASI POSE & BACKGROUND untuk menghindari hasil yang mirip
// ============================================================
const POSE_VARIATIONS = [
  "standing confidently with arms crossed, strong direct gaze at camera",
  "walking naturally mid-stride, dynamic and candid motion",
  "sitting casually on a surface, relaxed and effortless posture",
  "leaning against a wall with one shoulder, side profile, cool demeanor",
  "looking over shoulder, three-quarter back view, candid feel",
  "crouching down slightly, low-angle perspective looking up",
  "arms slightly raised with an expressive open gesture, engaging",
  "turning around mid-walk, caught in a natural candid moment",
  "standing with one hand in pocket, relaxed asymmetric pose",
  "sitting on steps or stairs, looking contemplatively to the side",
  "mid-jump or slight lift, energy and movement frozen in frame",
  "hands framing the face lightly, close and intimate framing",
];

const BACKGROUND_VARIATIONS = [
  "busy urban street with beautiful bokeh city lights in the background",
  "clean minimalist studio with a soft gradient white-to-grey backdrop",
  "lush green outdoor park, dappled natural sunlight through leaves",
  "cozy modern cafe interior, warm amber ambient lighting",
  "rooftop terrace at golden hour, city skyline glowing behind",
  "gritty industrial warehouse, dramatic high-contrast shadows",
  "beachside at sunset, warm golden and pink tones reflecting on water",
  "luxury hotel lobby with marble floors and elegant chandeliers",
  "forest path with soft light filtering through tall trees",
  "neon-lit urban alleyway at night, vibrant reflections on wet pavement",
  "open field during magic hour, soft warm backlight creating a rim glow",
  "sleek modern office building exterior with glass and steel architecture",
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
// FUNGSI GENERATE ADVANCED IMAGES — DENGAN VARIASI POSE & BG
// ============================================================
export async function generateAdvancedImages(
  formData: AdvancedImageFormData
): Promise<AdvancedImageResult[]> {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const results: AdvancedImageResult[] = [];
  const baseFilename = formData.filename || `gen_${Date.now()}`;

  const hasReference = formData.refModel || formData.refTop || formData.refBottom || formData.refProduct;

  // Simpan pilihan sebelumnya agar tidak terulang berturut-turut
  let lastPose = "";
  let lastBackground = "";
  let lastLighting = "";

  for (let i = 0; i < formData.count; i++) {
    let base64 = "";

    // -------------------------------------------------------
    // PILIH VARIASI ACAK — hindari pengulangan berturut-turut
    // -------------------------------------------------------
    const currentPose = lastPose
      ? randomPickExcluding(POSE_VARIATIONS, lastPose)
      : randomPick(POSE_VARIATIONS);

    const currentBackground = lastBackground
      ? randomPickExcluding(BACKGROUND_VARIATIONS, lastBackground)
      : randomPick(BACKGROUND_VARIATIONS);

    const currentLighting = lastLighting
      ? randomPickExcluding(LIGHTING_VARIATIONS, lastLighting)
      : randomPick(LIGHTING_VARIATIONS);

    lastPose = currentPose;
    lastBackground = currentBackground;
    lastLighting = currentLighting;

    // -------------------------------------------------------
    // GABUNGKAN PROMPT ASLI DENGAN VARIASI
    // -------------------------------------------------------
    const variedPrompt = `
${formData.prompt}

COMPOSITION REQUIREMENTS (MUST FOLLOW):
- Pose / Body Language: ${currentPose}
- Background / Environment: ${currentBackground}
- Lighting: ${currentLighting}
- Important: Make this image visually UNIQUE and DISTINCT from any other generation. 
  Do NOT repeat the same composition, angle, or environment.
- Photo quality: ultra-realistic, high-detail, professional photography, sharp focus.
    `.trim();

    let apiAspectRatio = formData.aspectRatio;
    if (formData.aspectRatio === '2:3' || formData.aspectRatio === '4:5') {
      apiAspectRatio = '3:4';
    }

    try {
      // -------------------------------------------------------
      // TANPA REFERENSI GAMBAR
      // -------------------------------------------------------
      if (!hasReference) {
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
      }
      // -------------------------------------------------------
      // DENGAN REFERENSI GAMBAR
      // -------------------------------------------------------
      else {
        const parts: Part[] = [];

        let contextPrompt = `
TASK: Generate a high-quality, photorealistic image based on the description below.
Use the provided reference images to maintain identity and style consistency.

SCENE DESCRIPTION:
"${variedPrompt}"

REFERENCE IMAGES PROVIDED:
`;

        if (formData.refModel) {
          parts.push({ inlineData: { data: formData.refModel.data, mimeType: formData.refModel.mimeType } });
          contextPrompt += `[Reference 1: Main Subject/Person — LOCK the face/identity from this reference. Do NOT change the face.]\n`;
        }
        if (formData.refTop) {
          parts.push({ inlineData: { data: formData.refTop.data, mimeType: formData.refTop.mimeType } });
          contextPrompt += `[Reference 2: Top Clothing — Use this exact garment style on the subject.]\n`;
        }
        if (formData.refBottom) {
          parts.push({ inlineData: { data: formData.refBottom.data, mimeType: formData.refBottom.mimeType } });
          contextPrompt += `[Reference 3: Bottom Clothing — Use this exact garment style on the subject.]\n`;
        }
        if (formData.refProduct) {
          parts.push({ inlineData: { data: formData.refProduct.data, mimeType: formData.refProduct.mimeType } });
          contextPrompt += `[Reference 4: Featured Product — Prominently feature this item in the scene.]\n`;
        }

        contextPrompt += `
STRICT INSTRUCTIONS:
1. FACE/IDENTITY: Must match Reference 1 exactly. Do NOT alter the face.
2. POSE: "${currentPose}" — This MUST be followed strictly.
3. BACKGROUND: "${currentBackground}" — Generate this environment, do NOT use the reference background.
4. LIGHTING: "${currentLighting}" — Apply this lighting style.
5. IMAGE QUALITY: Ultra-realistic, professional photography, sharp detail, 4K quality.
6. UNIQUENESS: This image must look visually DIFFERENT from any previous generation. Vary the composition.
7. Aspect Ratio: ${apiAspectRatio}.
        `.trim();

        parts.push({ text: contextPrompt });

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts: parts },
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
        prompt: variedPrompt,
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
