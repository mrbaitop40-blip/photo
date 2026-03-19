import React, { useState, useEffect, useRef } from 'react';
import { AspectRatio, ReferenceMode, GenderSelection, ImageTab, CharacterFormData, CharacterResult, PromptMakerFormData, PromptMakerResult, AdvancedImageFormData, AdvancedImageResult, ScenePreset } from './types';
import { MODEL_REGIONS, VISUAL_GENRES, CAMERA_ANGLES, CHARACTER_FRAMINGS, SCENE_PRESETS, SCENE_PRESET_CATEGORIES, FRAMING_OPTIONS } from './constants';
import { generateImage, generateCharacterSession, generateCreativeImagePrompts, generateAdvancedImages } from './services/geminiService';
import Icon from './components/Icon';
import ImageCropper from './components/ImageCropper';
import CollageEditor from './components/CollageEditor';
import GroupPhotoEditor from './components/GroupPhotoEditor';


const aspectRatioClasses: Record<AspectRatio, string> = {
    '9:16': 'aspect-[9/16]',
    '16:9': 'aspect-[16/9]',
    '1:1': 'aspect-square',
    '2:3': 'aspect-[2/3]',
    '3:4': 'aspect-[3/4]',
    '4:3': 'aspect-[4/3]',
    '4:5': 'aspect-[4/5]',
};

const parseAspectRatio = (ratio: AspectRatio | string): number => {
    try {
        const [w, h] = ratio.split(':').map(Number);
        return w / h;
    } catch { return 9/16; }
};

const sanitizeFilename = (name: string) => {
    const sanitized = name.replace(/[^a-z0-9_\-]/gi, '_');
    return sanitized.length > 0 ? sanitized : `image_${Date.now()}`;
};

const base64ToBlob = (base64: string, mimeType: string) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
};

const forceDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  requestAnimationFrame(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); });
};

// --- IndexedDB Helpers ---
const DB_NAME = 'ScriptMateDB';
const STORE_NAME = 'images';

const openDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror  = (event: any) => reject(event.target.error);
});

const saveImageToDB = async (image: AdvancedImageResult) => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
            const req = store.put(image);
            req.onsuccess = () => resolve(true);
            req.onerror   = () => reject(req.error);
        });
    } catch (error) { console.error("IndexedDB Save Error:", error); }
};

const deleteImageFromDB = async (id: string) => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
            const req = store.delete(id);
            req.onsuccess = () => resolve(true);
            req.onerror   = () => reject(req.error);
        });
    } catch (error) { console.error("IndexedDB Delete Error:", error); }
};

const getAllImagesFromDB = async (): Promise<AdvancedImageResult[]> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => {
                const results = req.result as AdvancedImageResult[];
                results.sort((a, b) => b.timestamp - a.timestamp);
                resolve(results);
            };
            req.onerror = () => reject(req.error);
        });
    } catch (error) { console.error("IndexedDB Load Error:", error); return []; }
};

const App: React.FC = () => {
  // ── API Key State ──
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiInput, setShowApiInput] = useState<boolean>(!localStorage.getItem('gemini_api_key'));
  const [apiKeySaved, setApiKeySaved] = useState<boolean>(!!localStorage.getItem('gemini_api_key'));

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (trimmed) {
      localStorage.setItem('gemini_api_key', trimmed);
      setApiKey(trimmed); setApiKeyInput(''); setShowApiInput(false); setApiKeySaved(true);
    }
  };
  const handleClearApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey(''); setApiKeyInput(''); setShowApiInput(true); setApiKeySaved(false);
  };

  // ── App State ──
  const [imageTab, setImageTab] = useState<ImageTab>('generate');
  const [charFormData, setCharFormData] = useState<CharacterFormData>({
      region: 'se_asia', customRegion: '', userDescription: '', framing: 'half_body',
      age: '25', gender: 'Female', genre: 'Photorealistic', aspectRatio: '9:16'
  });
  const [promptFormData, setPromptFormData] = useState<PromptMakerFormData>({ idea: '', genre: 'Cinematic', angle: 'Medium Shot' });
  const [advImgFormData, setAdvImgFormData] = useState<AdvancedImageFormData>({
      aspectRatio: '9:16', prompt: '', count: 1, poseMode: 'random', outfitMode: 'lock', framing: 'medium'
  });

  // ── Preset Scene state (tab Buat Gambar) ──
  const [selectedPreset, setSelectedPreset] = useState<ScenePreset | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  const [imageHistory, setImageHistory] = useState<AdvancedImageResult[]>([]);
  const [characterResult, setCharacterResult] = useState<CharacterResult | null>(null);
  const [promptMakerResult, setPromptMakerResult] = useState<PromptMakerResult | null>(null);
  const [advancedImageResults, setAdvancedImageResults] = useState<AdvancedImageResult[]>([]);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('AI sedang bersiap...');
  const [editingImage, setEditingImage] = useState<{ data: string; mimeType: string; aspectRatio?: AspectRatio } | null>(null);
  const [editingSlot, setEditingSlot] = useState<keyof AdvancedImageFormData | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<keyof AdvancedImageFormData | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAllImagesFromDB().then(images => setImageHistory(images)).catch(e => console.error("Failed to load from storage", e));
  }, []);

  useEffect(() => {
    if (isLoading) setLoadingMessage("Sedang memproses gambar Anda...");
  }, [isLoading]);

  const handleCharInputChange   = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setCharFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handlePromptMakerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setPromptFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleAdvImgChange      = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setAdvImgFormData(prev => ({ ...prev, [name]: name === 'count' ? parseInt(value, 10) : value }));
  };

  const checkApiKey = (): boolean => {
    const key = localStorage.getItem('gemini_api_key') || '';
    if (!key) {
      setError('API Key belum dimasukkan. Silakan masukkan Google AI Studio API Key Anda di bagian atas halaman.');
      setShowApiInput(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    return true;
  };

  const handleCharacterSession = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!checkApiKey()) return;
      setIsLoading(true); setError(null); setCharacterResult(null);
      try {
          const result = await generateCharacterSession(charFormData);
          setCharacterResult(result);
          await handleGenerateCharacterImageSequence(result);
      } catch (err: any) { setError(err.message); }
      finally { setIsLoading(false); }
  };

  const handleGenerateCharacterImageSequence = async (initialResult: CharacterResult) => {
       setCharacterResult(prev => prev ? { ...prev, isLoadingA: true, errorA: undefined } : initialResult);
       try {
           const imageA_Base64 = await generateImage(initialResult.promptA, charFormData.aspectRatio);
           const resultWithA = { ...initialResult, imageA: imageA_Base64, isLoadingA: false };
           setCharacterResult(prev => prev ? { ...prev, imageA: imageA_Base64, isLoadingA: false } : resultWithA);
           handleGenerateSideView(resultWithA, imageA_Base64);
       } catch (err: any) { setCharacterResult(prev => prev ? { ...prev, errorA: err.message, isLoadingA: false } : initialResult); }
  };

  const handleGenerateSideView = async (currentResult: CharacterResult, refImageBase64: string) => {
      setCharacterResult(prev => prev ? { ...prev, isLoadingB: true, errorB: undefined } : currentResult);
      try {
           const imageB_Base64 = await generateImage(currentResult.promptB, charFormData.aspectRatio, { data: refImageBase64, mimeType: 'image/png' }, 'pose-background');
           setCharacterResult(prev => prev ? { ...prev, imageB: imageB_Base64, isLoadingB: false } : null);
      } catch (err: any) { setCharacterResult(prev => prev ? { ...prev, errorB: err.message, isLoadingB: false } : null); }
  };

  const handlePromptMaker = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!checkApiKey()) return;
      setIsLoading(true); setError(null);
      try { setPromptMakerResult(await generateCreativeImagePrompts(promptFormData)); }
      catch (err: any) { setError(err.message); }
      finally { setIsLoading(false); }
  };

  const handleAdvancedImageGen = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!checkApiKey()) return;
      setIsLoading(true); setError(null); setAdvancedImageResults([]);
      try {
          const results = await generateAdvancedImages(advImgFormData);
          setAdvancedImageResults(results);
          for (const res of results) await saveImageToDB(res);
          setImageHistory((await getAllImagesFromDB()).slice(0, 50));
      } catch (err: any) { setError(err.message); }
      finally { setIsLoading(false); }
  };

  const handleAdvImageUpload = (slot: keyof AdvancedImageFormData, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
        const result = reader.result as string;
        setEditingImage({ data: result.split(',')[1], mimeType: file.type, aspectRatio: advImgFormData.aspectRatio });
        setEditingSlot(slot);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver  = (e: React.DragEvent<HTMLDivElement>, slot: keyof AdvancedImageFormData) => { e.preventDefault(); e.stopPropagation(); setDragOverSlot(slot); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setDragOverSlot(null); };
  const handleDrop      = (e: React.DragEvent<HTMLDivElement>, slot: keyof AdvancedImageFormData) => {
      e.preventDefault(); e.stopPropagation(); setDragOverSlot(null);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) handleAdvImageUpload(slot, file);
  };

  const handleDownloadReference  = (base64: string, mimeType: string) => forceDownload(base64ToBlob(base64, 'application/octet-stream'), `referensi_${Date.now()}.png`);
  const handleAdjustReference    = (slot?: keyof AdvancedImageFormData) => {
      if (slot) {
          const ref = advImgFormData[slot];
          if (ref) { setEditingImage({ data: (ref as any).data, mimeType: (ref as any).mimeType, aspectRatio: advImgFormData.aspectRatio }); setEditingSlot(slot); }
      }
  };
  const handleResetReference = (slot?: keyof AdvancedImageFormData) => { if (slot) setAdvImgFormData(prev => ({ ...prev, [slot]: undefined })); };

  const handleCropComplete = async (croppedImage: { data: string; mimeType: string }) => {
    if (editingResultId) {
        const updatedResults = advancedImageResults.map(res => res.id === editingResultId ? { ...res, base64: croppedImage.data } : res);
        setAdvancedImageResults(updatedResults);
        const target = updatedResults.find(r => r.id === editingResultId);
        if (target) { await saveImageToDB(target); setImageHistory((await getAllImagesFromDB()).slice(0, 50)); }
        setEditingResultId(null);
    } else if (editingSlot) {
        setAdvImgFormData(prev => ({ ...prev, [editingSlot]: croppedImage }));
        setEditingSlot(null);
    }
    setEditingImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropCancel = () => { setEditingImage(null); setEditingSlot(null); setEditingResultId(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const handleDownloadImagePlusPrompt = (result: AdvancedImageResult) => {
      const safeName = sanitizeFilename(result.filename);
      const promptContent = `PROMPT:\n${result.prompt}\n\nVIDEO PROMPT (I2V):\n${result.videoPrompt || 'Tidak ada video prompt.'}`;
      forceDownload(new Blob([promptContent], { type: 'application/octet-stream' }), `${safeName}_prompt.txt`);
      setTimeout(() => forceDownload(base64ToBlob(result.base64, 'application/octet-stream'), `${safeName}.png`), 800);
  };

  const deleteImageHistoryItem = async (id: string) => {
      await deleteImageFromDB(id);
      setImageHistory((await getAllImagesFromDB()).slice(0, 50));
  };

  // ── Apakah mode lock pose tersedia (hanya jika refModel ada) ──
  const hasRefModel = !!advImgFormData.refModel;

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {editingImage && (
        <ImageCropper
          imageSrc={`data:${editingImage.mimeType};base64,${editingImage.data}`}
          imageMimeType={editingImage.mimeType}
          targetAspectRatio={parseAspectRatio(editingImage.aspectRatio || (editingSlot ? advImgFormData.aspectRatio : '9:16'))}
          aspectRatio={editingImage.aspectRatio || (editingSlot ? advImgFormData.aspectRatio : '9:16')}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}

      {/* ── HEADER ── */}
      <header className="text-center mb-6 w-full max-w-7xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 pb-2 px-1">AkariuPhoto</h1>
        <p className="text-slate-400 mt-2">
          Copywriter & Sutradara Visual{' '}
          <a href="https://akariu.blogspot.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">
            https://akariu.blogspot.com/
          </a>
        </p>

        {/* ── PANEL API KEY ── */}
        <div className="mt-4 bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-left">
          {showApiInput ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔑</span>
                <p className="text-sm font-semibold text-slate-200">Masukkan Google AI Studio API Key</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dapatkan gratis di{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-medium">
                  aistudio.google.com/app/apikey
                </a>
                <span className="text-slate-600 mx-1.5">•</span>
                <a href="https://aistudio.google.com/rate-limit?timeRange=last-1-day" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300 underline font-medium inline-flex items-center gap-1">
                  <span>📊</span> Cek Limit Harian
                </a>
              </p>
              <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/50 rounded-lg px-3 py-2">
                <span className="text-green-400 text-sm">🔒</span>
                <p className="text-xs text-green-300">API Key Anda hanya disimpan di browser anda sendiri (localStorage) dan langsung dikirim ke Google. Selama akun google anda tidak terhubung dengan pembayaran penggunan hanya mengikuti FREE QUOTA dari Google, API Key di Buat di Google Aistudio dan dapat di hapus kapan saja dari akun Google anda. Tidak ada server pihak ketiga yang menyimpan atau membaca key anda.</p>
              </div>
              <div className="flex gap-2">
                <input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveApiKey()} placeholder="Paste API Key di sini... (AIzaSy...)" className="flex-grow bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
                <button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-md text-sm whitespace-nowrap">Simpan Key</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✅</span>
                <p className="text-sm text-green-300 font-medium">API Key tersimpan di browser Anda</p>
              </div>
              <div className="flex items-center gap-3">
                <a href="https://aistudio.google.com/rate-limit?timeRange=last-1-day" target="_blank" rel="noopener noreferrer" className="text-xs text-amber-400 hover:text-amber-300 underline inline-flex items-center gap-1">
                  <span>📊</span> Cek Limit Harian
                </a>
                <button onClick={handleClearApiKey} className="text-xs text-slate-400 hover:text-red-400 underline">Ganti / Hapus Key</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── TAB NAVIGASI ── */}
      <div className="w-full max-w-7xl mb-4">
        <div className="grid grid-cols-5 gap-1 bg-slate-700 p-1 rounded-lg">
          {(['character', 'generate', 'group', 'prompt-maker', 'collage'] as ImageTab[]).map(t => (
            <button type="button" key={t} onClick={() => setImageTab(t)}
              className={`px-2 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors ${imageTab === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-600/50'}`}
            >
              {t === 'character' ? 'Karakter'
               : t === 'generate' ? 'Buat Gambar'
               : t === 'group' ? '👨‍👩‍👧‍👦 Foto Grup'
               : t === 'prompt-maker' ? 'Buat Prompt'
               : 'Kolase'}
            </button>
          ))}
        </div>
      </div>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── FORM COLUMN ── */}
        <div className={`lg:col-span-4 space-y-6 ${imageTab === 'collage' || imageTab === 'group' ? 'hidden' : ''}`}>
          <form onSubmit={imageTab === 'character' ? handleCharacterSession : imageTab === 'prompt-maker' ? handlePromptMaker : handleAdvancedImageGen}
            className="bg-slate-800/50 rounded-xl p-6 space-y-6">

            {/* ════ TAB: CHARACTER ════ */}
            {imageTab === 'character' && (
              <fieldset className="space-y-4" disabled={isLoading}>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Region / Race</label>
                  <select name="region" value={charFormData.region} onChange={handleCharInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white mb-2">
                    {MODEL_REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                    <option value="others">Lainnya (Input Manual)</option>
                  </select>
                  {charFormData.region === 'others' && (
                    <input name="customRegion" value={charFormData.customRegion || ''} onChange={handleCharInputChange} placeholder="Ketik manual wilayah/ras..." className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white animate-fade-in" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Framing / Shot Type</label>
                  <div className="grid grid-cols-3 gap-2 bg-slate-700 p-1 rounded-lg">
                    {CHARACTER_FRAMINGS.map(f => (
                      <button type="button" key={f.id} onClick={() => setCharFormData(prev => ({ ...prev, framing: f.id }))}
                        className={`px-2 py-2 rounded-md text-xs font-semibold transition-colors flex flex-col items-center justify-center text-center h-full ${charFormData.framing === f.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-600/50'}`}
                      >{f.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Deskripsi Tambahan (Opsional)</label>
                  <textarea name="userDescription" value={charFormData.userDescription || ''} onChange={handleCharInputChange} placeholder="Cth: Hijab pashmina warna pastel, kacamata bulat..." rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-slate-300 mb-1">Age</label><input name="age" value={charFormData.age} onChange={handleCharInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" /></div>
                  <div><label className="block text-sm font-medium text-slate-300 mb-1">Gender</label><select name="gender" value={charFormData.gender} onChange={handleCharInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white"><option>Male</option><option>Female</option></select></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Genre Visual</label>
                  <select name="genre" value={charFormData.genre} onChange={handleCharInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white">
                    {VISUAL_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Aspek Rasio</label>
                  <select name="aspectRatio" value={charFormData.aspectRatio} onChange={handleCharInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white">
                    <option value="9:16">9:16 (Portrait)</option><option value="1:1">1:1 (Square)</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all">
                  {isLoading ? 'Membuat Karakter...' : 'Generate Character'}
                </button>
              </fieldset>
            )}

            {/* ════ TAB: PROMPT MAKER ════ */}
            {imageTab === 'prompt-maker' && (
              <fieldset className="space-y-4" disabled={isLoading}>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Ide Sederhana</label><textarea name="idea" value={promptFormData.idea} onChange={handlePromptMakerChange} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" placeholder="Contoh: Kucing cyberpunk minum kopi di neon city" /></div>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Genre Visual</label><select name="genre" value={promptFormData.genre} onChange={handlePromptMakerChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white">{VISUAL_GENRES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-slate-300 mb-1">Camera Angle</label><select name="angle" value={promptFormData.angle} onChange={handlePromptMakerChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white">{CAMERA_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all">{isLoading ? 'Membuat Prompt...' : 'Buat Prompt'}</button>
              </fieldset>
            )}

            {/* ════ TAB: GENERATE ════ */}
            {imageTab === 'generate' && (
              <fieldset className="space-y-4" disabled={isLoading}>

                {/* ── Preset Scene Picker ── */}
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎬</span>
                      <div>
                        <p className="text-sm font-bold text-white">Scene Preset</p>
                        <p className="text-[11px] text-indigo-300/70">Pilih template siap pakai — bisa diedit bebas</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setShowPresets(o => !o)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        showPresets
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-600/20 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/40'
                      }`}>
                      {showPresets ? '▲ Tutup' : '▼ Buka Preset'}
                    </button>
                  </div>

                  {/* Grid preset */}
                  {showPresets && (
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {SCENE_PRESET_CATEGORIES.map(cat => (
                        <div key={cat}>
                          <p className="text-[11px] font-bold text-indigo-400/80 uppercase tracking-widest mb-2">{cat}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {SCENE_PRESETS.filter(p => p.category === cat).map(preset => (
                              <button key={preset.id} type="button"
                                onClick={() => {
                                  setSelectedPreset(preset);
                                  setAdvImgFormData(prev => ({ ...prev, prompt: preset.prompt }));
                                  setShowPresets(false);
                                }}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all border ${
                                  selectedPreset?.id === preset.id
                                    ? 'border-indigo-400 bg-indigo-600/30 text-white shadow-lg shadow-indigo-500/10'
                                    : 'border-slate-600/60 bg-slate-800/60 text-slate-200 hover:border-indigo-500/60 hover:bg-slate-700/60'
                                }`}
                              >
                                <span className="text-base">{preset.icon}</span>
                                <span className="text-xs font-semibold leading-tight">{preset.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Status preset aktif */}
                  {selectedPreset ? (
                    <div className="flex items-center justify-between bg-indigo-600/20 border border-indigo-500/40 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{selectedPreset.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-white">{selectedPreset.label}</p>
                          <p className="text-[10px] text-indigo-300/70">Preset aktif — prompt sudah terisi</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => {
                        setSelectedPreset(null);
                        setAdvImgFormData(prev => ({ ...prev, prompt: '' }));
                      }} className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10 transition-all">
                        ✕ Hapus
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 text-center">
                      Belum ada preset dipilih — tulis prompt sendiri atau pilih preset di atas
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Prompt / Deskripsi</label>
                  <textarea name="prompt" value={advImgFormData.prompt}
                    onChange={e => {
                      handleAdvImgChange(e);
                      if (selectedPreset && e.target.value !== selectedPreset.prompt) setSelectedPreset(null);
                    }}
                    rows={4} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" placeholder="Deskripsikan gambar yang ingin dibuat, atau pilih preset di atas..." />
                </div>

                {/* ── Framing / Shot Type ── */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Framing / Jarak Kamera
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FRAMING_OPTIONS.map(f => (
                      <button key={f.id} type="button"
                        onClick={() => setAdvImgFormData(prev => ({ ...prev, framing: f.id as any }))}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 text-center transition-all ${
                          advImgFormData.framing === f.id
                            ? 'border-indigo-500 bg-indigo-600/25 shadow-lg shadow-indigo-500/10'
                            : 'border-slate-600/60 bg-slate-700/40 hover:border-indigo-500/50'
                        }`}
                      >
                        <span className="text-base leading-none">{f.icon}</span>
                        <span className={`text-[10px] font-bold leading-tight ${advImgFormData.framing === f.id ? 'text-white' : 'text-slate-300'}`}>
                          {f.label}
                        </span>
                        <span className="text-[9px] text-slate-500 leading-tight hidden sm:block">{f.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Aspek Rasio</label>
                    <select name="aspectRatio" value={advImgFormData.aspectRatio} onChange={handleAdvImgChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white">
                      {(['9:16', '16:9', '1:1', '2:3', '4:5'] as AspectRatio[]).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Jumlah Gambar</label>
                    <input type="number" name="count" value={advImgFormData.count} onChange={handleAdvImgChange} min="1" max="10" className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nama File (Opsional)</label>
                  <input type="text" name="filename" value={advImgFormData.filename || ''} onChange={handleAdvImgChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" placeholder="cth: boni" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Fokus Item (Untuk Prompt Video)</label>
                  <textarea name="focusItem" value={advImgFormData.focusItem || ''} onChange={handleAdvImgChange} rows={2} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" placeholder="cth: bordir bunga elegan pada lengan" />
                  <p className="text-xs text-slate-400 mt-1">Jika diisi, AI akan membuat prompt khusus untuk mengubah gambar ini menjadi video.</p>
                </div>

                {/* ════ REFERENSI GAMBAR ════ */}
                <div className="space-y-3 pt-4 border-t border-slate-700/50">
                  <label className="block text-sm font-medium text-slate-300">Referensi Gambar (Drag & Drop)</label>
                  <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={e => {
                    if (e.target.files?.[0] && editingSlot) handleAdvImageUpload(editingSlot, e.target.files[0]);
                  }} />

                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { key: 'refModel',   label: 'Model Utama' },
                      { key: 'refTop',     label: 'Atasan (Opsional)' },
                      { key: 'refBottom',  label: 'Bawahan (Opsional)' },
                      { key: 'refProduct', label: 'Produk Lain' }
                    ] as const).map((slot) => (
                      <div key={slot.key}
                        className={`relative overflow-hidden rounded-lg cursor-pointer transition-colors ${aspectRatioClasses[advImgFormData.aspectRatio]} ${advImgFormData[slot.key] ? 'border-indigo-500 bg-black' : dragOverSlot === slot.key ? 'border-2 border-dashed border-indigo-400 bg-slate-700' : 'border-2 border-dashed border-slate-600 hover:bg-slate-700/50'}`}
                        onDragOver={e => handleDragOver(e, slot.key)}
                        onDragLeave={handleDragLeave}
                        onDrop={e => handleDrop(e, slot.key)}
                      >
                        {advImgFormData[slot.key] ? (
                          <>
                            <img src={`data:${(advImgFormData[slot.key] as any).mimeType};base64,${(advImgFormData[slot.key] as any).data}`} className="w-full h-full object-cover opacity-80" />
                            <div className="absolute top-0 left-0 bg-black/60 px-2 py-1 rounded-br text-xs text-white font-medium z-10">{slot.label}</div>
                            <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex flex-wrap items-center justify-center gap-1.5 p-2">
                              <button type="button" onClick={() => handleAdjustReference(slot.key)} className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow"><Icon type="adjust" className="w-4 h-4" /></button>
                              <button type="button" onClick={() => handleDownloadReference((advImgFormData[slot.key] as any).data, (advImgFormData[slot.key] as any).mimeType)} className="p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded shadow"><Icon type="download" className="w-4 h-4" /></button>
                              <button type="button" onClick={() => { setEditingSlot(slot.key); fileInputRef.current?.click(); }} className="p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded shadow"><Icon type="edit" className="w-4 h-4" /></button>
                              <button type="button" onClick={() => handleResetReference(slot.key)} className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded shadow"><Icon type="trash" className="w-4 h-4" /></button>
                            </div>
                          </>
                        ) : (
                          <div onClick={() => { setEditingSlot(slot.key); fileInputRef.current?.click(); }} className="w-full h-full flex flex-col items-center justify-center p-2">
                            <Icon type="download" className="w-6 h-6 text-slate-400 mb-2" />
                            <span className={`text-xs text-center ${dragOverSlot === slot.key ? 'text-indigo-300 font-bold' : 'text-slate-400'}`}>
                              {dragOverSlot === slot.key ? 'Lepaskan Gambar!' : slot.label}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* ════ POSE MODE TOGGLE ════ */}
                  <div className={`rounded-xl border p-4 space-y-3 transition-all duration-300 ${hasRefModel ? 'border-indigo-500/40 bg-indigo-950/30' : 'border-slate-700/50 bg-slate-800/30 opacity-50 pointer-events-none'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🧍</span>
                      <p className="text-sm font-semibold text-slate-200">Pose Model Utama</p>
                      {!hasRefModel && <span className="text-xs text-slate-500 italic">(Upload Model Utama dulu)</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* RANDOM */}
                      <button
                        type="button"
                        disabled={!hasRefModel}
                        onClick={() => setAdvImgFormData(prev => ({ ...prev, poseMode: 'random' }))}
                        className={`relative flex flex-col items-start gap-1.5 p-3 rounded-lg border-2 text-left transition-all ${
                          advImgFormData.poseMode !== 'lock'
                            ? 'border-indigo-500 bg-indigo-600/20 shadow-lg shadow-indigo-500/10'
                            : 'border-slate-600 bg-slate-700/40 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-lg">🎲</span>
                          <span className="text-sm font-bold text-white">Pose Acak</span>
                          {advImgFormData.poseMode !== 'lock' && (
                            <span className="ml-auto text-[10px] font-bold bg-indigo-500 text-white px-1.5 py-0.5 rounded-full">AKTIF</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">Setiap gambar mendapat pose & latar yang berbeda-beda secara otomatis.</p>
                      </button>

                      {/* LOCK */}
                      <button
                        type="button"
                        disabled={!hasRefModel}
                        onClick={() => setAdvImgFormData(prev => ({ ...prev, poseMode: 'lock' }))}
                        className={`relative flex flex-col items-start gap-1.5 p-3 rounded-lg border-2 text-left transition-all ${
                          advImgFormData.poseMode === 'lock'
                            ? 'border-emerald-500 bg-emerald-600/20 shadow-lg shadow-emerald-500/10'
                            : 'border-slate-600 bg-slate-700/40 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-lg">🔒</span>
                          <span className="text-sm font-bold text-white">Kunci Pose</span>
                          {advImgFormData.poseMode === 'lock' && (
                            <span className="ml-auto text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">AKTIF</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">AI akan meniru postur tubuh dari foto Model Utama yang diunggah.</p>
                      </button>
                    </div>

                    {/* Status indicator */}
                    {hasRefModel && (
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                        advImgFormData.poseMode === 'lock'
                          ? 'bg-emerald-900/30 border border-emerald-700/50 text-emerald-300'
                          : 'bg-indigo-900/30 border border-indigo-700/50 text-indigo-300'
                      }`}>
                        <span>{advImgFormData.poseMode === 'lock' ? '🔒' : '🎲'}</span>
                        <span>
                          {advImgFormData.poseMode === 'lock'
                            ? 'Wajah + Postur dari referensi akan dikunci. Background tetap diacak.'
                            : 'Wajah dikunci dari referensi. Pose & background diacak setiap generate.'
                          }
                        </span>
                      </div>
                    )}

                    {/* Face lock info — selalu tampil jika ada refModel */}
                    {hasRefModel && (
                      <div className="flex items-start gap-2 bg-purple-900/20 border border-purple-700/40 rounded-lg px-3 py-2">
                        <span className="text-purple-400 text-sm mt-0.5">🧬</span>
                        <p className="text-xs text-purple-300 leading-relaxed">
                          <span className="font-semibold">Face Lock selalu aktif</span> saat Model Utama diunggah —
                          AI akan berusaha keras mempertahankan identitas wajah dari referensi.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ════ OUTFIT MODE TOGGLE ════ */}
                  {(() => {
                    const hasTop    = !!advImgFormData.refTop;
                    const hasBottom = !!advImgFormData.refBottom;
                    const hasTryOn  = hasTop || hasBottom;
                    // Panel hanya muncul jika ada refModel
                    if (!hasRefModel) return null;
                    return (
                      <div className={`rounded-xl border p-4 space-y-3 transition-all duration-300 ${hasTryOn ? 'border-sky-500/40 bg-sky-950/20' : 'border-slate-600/50 bg-slate-800/30'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">👗</span>
                          <p className="text-sm font-semibold text-slate-200">Mode Pakaian</p>
                        </div>

                        {hasTryOn ? (
                          /* ── Jika ada try-on: tampilkan status saja ── */
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 bg-sky-900/30 border border-sky-700/40 rounded-lg px-3 py-2">
                              <span className="text-sky-400">👕</span>
                              <div className="text-xs text-sky-300 space-y-0.5">
                                <p className="font-semibold">Mode Try-On Aktif</p>
                                <p className="text-sky-400/80">
                                  {[hasTop && 'Atasan dari referensi', hasBottom && 'Bawahan dari referensi'].filter(Boolean).join(' + ')} akan dipakaikan ke model.
                                  {!hasTop  && ' Atasan dipertahankan dari foto model.'}
                                  {!hasBottom && ' Bawahan dipertahankan dari foto model.'}
                                </p>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-500 italic px-1">
                              Toggle kunci/acak tidak berlaku saat ada referensi atasan/bawahan.
                            </p>
                          </div>
                        ) : (
                          /* ── Tidak ada try-on: tampilkan tombol toggle ── */
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              {/* LOCK OUTFIT */}
                              <button
                                type="button"
                                onClick={() => setAdvImgFormData(prev => ({ ...prev, outfitMode: 'lock' }))}
                                className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border-2 text-left transition-all ${
                                  advImgFormData.outfitMode !== 'random'
                                    ? 'border-sky-500 bg-sky-600/20 shadow-lg shadow-sky-500/10'
                                    : 'border-slate-600 bg-slate-700/40 hover:border-slate-500'
                                }`}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <span className="text-lg">🔒</span>
                                  <span className="text-sm font-bold text-white">Kunci Pakaian</span>
                                  {advImgFormData.outfitMode !== 'random' && (
                                    <span className="ml-auto text-[10px] font-bold bg-sky-500 text-white px-1.5 py-0.5 rounded-full">AKTIF</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">Pakaian dari foto Model Utama dipertahankan persis di setiap generate.</p>
                              </button>

                              {/* RANDOM OUTFIT */}
                              <button
                                type="button"
                                onClick={() => setAdvImgFormData(prev => ({ ...prev, outfitMode: 'random' }))}
                                className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border-2 text-left transition-all ${
                                  advImgFormData.outfitMode === 'random'
                                    ? 'border-orange-500 bg-orange-600/20 shadow-lg shadow-orange-500/10'
                                    : 'border-slate-600 bg-slate-700/40 hover:border-slate-500'
                                }`}
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <span className="text-lg">✨</span>
                                  <span className="text-sm font-bold text-white">Pakaian Bebas</span>
                                  {advImgFormData.outfitMode === 'random' && (
                                    <span className="ml-auto text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">AKTIF</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-snug">AI memilih pakaian yang cocok dengan scene & prompt secara kreatif.</p>
                              </button>
                            </div>

                            {/* Status indicator */}
                            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                              advImgFormData.outfitMode === 'random'
                                ? 'bg-orange-900/30 border border-orange-700/50 text-orange-300'
                                : 'bg-sky-900/30 border border-sky-700/50 text-sky-300'
                            }`}>
                              <span>{advImgFormData.outfitMode === 'random' ? '✨' : '🔒'}</span>
                              <span>
                                {advImgFormData.outfitMode === 'random'
                                  ? 'AI bebas memilih outfit yang sesuai mood & scene.'
                                  : 'Outfit dari foto model akan dikunci di setiap gambar yang dihasilkan.'
                                }
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* ════ DESKRIPSI PRODUK ════ */}
                {advImgFormData.refProduct && (
                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📦</span>
                      <p className="text-sm font-semibold text-amber-200">Deskripsi Produk</p>
                      <span className="text-xs text-amber-500/70 italic">(Opsional tapi sangat disarankan)</span>
                    </div>

                    <textarea
                      name="refProductDesc"
                      value={advImgFormData.refProductDesc || ''}
                      onChange={handleAdvImgChange}
                      rows={3}
                      placeholder={`Deskripsikan produk secara detail untuk akurasi lebih tinggi.\n\nContoh: "Botol kaca 250ml, label putih, logo merah oval di tengah, tutup hitam, tulisan BRAND X ukuran besar di atas logo"`}
                      className="w-full bg-slate-800/60 border border-amber-600/30 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder-slate-500 resize-none"
                    />

                    <div className="space-y-1.5">
                      <p className="text-[11px] text-amber-300/80 font-semibold">Tips deskripsi efektif:</p>
                      <div className="grid grid-cols-1 gap-1">
                        {[
                          { icon: '🎨', text: 'Warna: warna utama, warna aksen, gradasi' },
                          { icon: '🔤', text: 'Teks & Logo: nama brand, posisi, ukuran font' },
                          { icon: '📐', text: 'Bentuk: kotak, bulat, botol, tabung, dll' },
                          { icon: '✨', text: 'Material: glossy, matte, metalik, transparan' },
                        ].map(tip => (
                          <div key={tip.icon} className="flex items-center gap-1.5">
                            <span className="text-xs">{tip.icon}</span>
                            <span className="text-[10px] text-slate-400">{tip.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                      <span className="text-amber-400 text-sm mt-0.5">💡</span>
                      <p className="text-[11px] text-amber-300/90 leading-relaxed">
                        Semakin detail deskripsi, semakin akurat AI mereproduksi produk.
                        Deskripsi juga membantu AI memilih apakah produk <span className="font-semibold">dikenakan, dipegang, atau dipamerkan</span>.
                      </p>
                    </div>
                  </div>
                )}

                <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2">
                  {isLoading ? 'Memproses Gambar...' : 'Buat Gambar'}
                </button>
              </fieldset>
            )}
          </form>
        </div>

        {/* ── RESULTS COLUMN ── */}
        <div className={`${imageTab === 'collage' || imageTab === 'group' ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-8`}>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl flex items-start gap-3">
              <Icon type="delete" className="w-6 h-6 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {isLoading && (
            <div className="bg-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4 animate-pulse">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center"><Icon type="sparkles" className="w-6 h-6 text-indigo-400" /></div>
              </div>
              <p className="text-lg font-medium text-slate-300">{loadingMessage}</p>
            </div>
          )}

          {imageTab === 'collage' && <CollageEditor />}
          {imageTab === 'group'   && <GroupPhotoEditor />}

          <div className="space-y-8">
            {/* ── Character Results ── */}
            {imageTab === 'character' && characterResult && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-4">Hasil Karakter</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {(['A', 'B'] as const).map(side => {
                    const img   = side === 'A' ? characterResult.imageA   : characterResult.imageB;
                    const loading = side === 'A' ? characterResult.isLoadingA : characterResult.isLoadingB;
                    const errMsg  = side === 'A' ? characterResult.errorA   : characterResult.errorB;
                    return (
                      <div key={side} className="space-y-2">
                        <p className="text-sm font-medium text-slate-400">{side === 'A' ? 'Tampak Depan (Portrait)' : 'Tampak Samping / Gaya Lain'}</p>
                        <div className={`relative bg-black rounded-lg overflow-hidden ${aspectRatioClasses[charFormData.aspectRatio]}`}>
                          {loading ? <div className="absolute inset-0 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
                            : img ? <img src={`data:image/png;base64,${img}`} alt={`Character ${side}`} className="w-full h-full object-cover" />
                            : errMsg ? <div className="absolute inset-0 flex items-center justify-center p-4 text-red-400 text-xs text-center">{errMsg}</div>
                            : null}
                          {img && <div className="absolute top-2 right-2"><button onClick={() => handleDownloadReference(img, 'image/png')} className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70"><Icon type="download" className="w-4 h-4" /></button></div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-xs text-slate-400 font-mono mb-1">Character Description:</p>
                  <p className="text-sm text-slate-300">{characterResult.summary}</p>
                </div>
              </div>
            )}

            {/* ── Prompt Maker Results ── */}
            {imageTab === 'prompt-maker' && promptMakerResult && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
                <h3 className="text-lg font-bold text-white">Hasil Prompt</h3>
                {[{ label: 'Prompt Bahasa Indonesia (Artistik)', text: promptMakerResult.indoPrompt }, { label: 'Prompt English (AI Optimized)', text: promptMakerResult.engPrompt }].map(({ label, text }) => (
                  <div key={label} className="space-y-2">
                    <label className="text-sm font-medium text-indigo-400">{label}</label>
                    <div className="bg-slate-900/50 p-3 rounded-lg flex gap-3">
                      <p className="text-sm text-slate-300 flex-grow">{text}</p>
                      <button onClick={() => navigator.clipboard.writeText(text)} className="text-slate-400 hover:text-white"><Icon type="copy" className="w-5 h-5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Advanced Image Results ── */}
            {advancedImageResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {advancedImageResults.map(res => (
                  <div key={res.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 relative group">
                    <div className={`w-full ${aspectRatioClasses[res.aspectRatio]} bg-black relative`}>
                      <img src={`data:image/png;base64,${res.base64}`} alt={res.prompt} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={() => handleDownloadImagePlusPrompt(res)} className="p-2 bg-slate-700 text-white rounded-full hover:bg-indigo-600"><Icon type="download" className="w-5 h-5" /></button>
                        <button onClick={() => { setEditingResultId(res.id); setEditingImage({ data: res.base64, mimeType: 'image/png', aspectRatio: res.aspectRatio }); }} className="p-2 bg-slate-700 text-white rounded-full hover:bg-indigo-600"><Icon type="adjust" className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-slate-400 line-clamp-2 mb-2">{res.prompt}</p>
                      {res.videoPrompt && (
                        <div className="bg-slate-900/50 p-2 rounded relative">
                          <div className="flex justify-between items-start"><p className="text-[10px] text-indigo-300 font-bold mb-1">VIDEO PROMPT:</p><button onClick={() => navigator.clipboard.writeText(res.videoPrompt!)} className="text-slate-400 hover:text-white"><Icon type="copy" className="w-3 h-3" /></button></div>
                          <p className="text-[10px] text-slate-400 line-clamp-3">{res.videoPrompt}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Image History ── */}
            {imageHistory.length > 0 && (
              <div className="pt-8 border-t border-slate-700">
                <h2 className="text-xl font-bold text-slate-400 mb-6 flex items-center gap-2"><Icon type="history" className="w-5 h-5" />Galeri Riwayat</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageHistory.map(img => (
                    <div key={img.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 relative group">
                      <div className={`w-full ${aspectRatioClasses[img.aspectRatio]} bg-black relative`}>
                        <img src={`data:image/png;base64,${img.base64}`} className="w-full h-full object-cover" alt={img.prompt} />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button onClick={() => handleDownloadImagePlusPrompt(img)} className="p-2 bg-slate-700 text-white rounded-full hover:bg-indigo-600"><Icon type="download" className="w-5 h-5" /></button>
                          <button onClick={() => deleteImageHistoryItem(img.id)} className="p-2 bg-slate-700 text-white rounded-full hover:bg-red-600"><Icon type="trash" className="w-5 h-5" /></button>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-slate-400 line-clamp-2 mb-2">{img.prompt}</p>
                        {img.videoPrompt && (
                          <div className="bg-slate-900/50 p-2 rounded relative">
                            <div className="flex justify-between items-start"><p className="text-[10px] text-indigo-300 font-bold mb-1">VIDEO PROMPT:</p><button onClick={() => navigator.clipboard.writeText(img.videoPrompt!)} className="text-slate-400 hover:text-white"><Icon type="copy" className="w-3 h-3" /></button></div>
                            <p className="text-[10px] text-slate-400 line-clamp-3">{img.videoPrompt}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;
