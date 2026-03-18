import React, { useState, useEffect, useRef } from 'react';
import { AspectRatio, ReferenceMode, GenderSelection, ImageTab, CharacterFormData, CharacterResult, PromptMakerFormData, PromptMakerResult, AdvancedImageFormData, AdvancedImageResult } from './types';
import { MODEL_REGIONS, VISUAL_GENRES, CAMERA_ANGLES, CHARACTER_FRAMINGS } from './constants';
import { generateImage, generateCharacterSession, generateCreativeImagePrompts, generateAdvancedImages } from './services/geminiService';
import Icon from './components/Icon';
import ImageCropper from './components/ImageCropper';
import CollageEditor from './components/CollageEditor';


const GENDER_LABELS: Record<GenderSelection, string> = {
    wanita: 'Wanita',
    pria: 'Pria',
    'pria & wanita': 'Pria & Wanita'
};

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
    } catch {
        return 9/16;
    }
};

const sanitizeFilename = (name: string) => {
    const sanitized = name.replace(/[^a-z0-9_\-]/gi, '_');
    return sanitized.length > 0 ? sanitized : `image_${Date.now()}`;
};

const base64ToBlob = (base64: string, mimeType: string) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

const forceDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  requestAnimationFrame(() => {
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  });
};

// --- IndexedDB Helpers ---
const DB_NAME = 'ScriptMateDB';
const STORE_NAME = 'images';

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (event: any) => resolve(event.target.result);
        request.onerror = (event: any) => reject(event.target.error);
    });
};

const saveImageToDB = async (image: AdvancedImageResult) => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(image);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("IndexedDB Save Error:", error);
    }
};

const deleteImageFromDB = async (id: string) => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
         console.error("IndexedDB Delete Error:", error);
    }
};

const getAllImagesFromDB = async (): Promise<AdvancedImageResult[]> => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                const results = request.result as AdvancedImageResult[];
                results.sort((a, b) => b.timestamp - a.timestamp);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error("IndexedDB Load Error:", error);
        return [];
    }
};

const App: React.FC = () => {
  // ============================================================
  // STATE API KEY
  // ============================================================
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showApiInput, setShowApiInput] = useState<boolean>(!localStorage.getItem('gemini_api_key'));
  const [apiKeySaved, setApiKeySaved] = useState<boolean>(!!localStorage.getItem('gemini_api_key'));

  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (trimmed) {
      localStorage.setItem('gemini_api_key', trimmed);
      setApiKey(trimmed);
      setApiKeyInput('');
      setShowApiInput(false);
      setApiKeySaved(true);
    }
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setApiKeyInput('');
    setShowApiInput(true);
    setApiKeySaved(false);
  };

  // ============================================================
  // STATE UTAMA APLIKASI
  // ============================================================
  const [imageTab, setImageTab] = useState<ImageTab>('character');
  
  const [charFormData, setCharFormData] = useState<CharacterFormData>({ 
      region: 'se_asia', 
      customRegion: '', 
      userDescription: '', 
      framing: 'half_body', 
      age: '25', 
      gender: 'Female', 
      genre: 'Photorealistic', 
      aspectRatio: '9:16' 
  });
  const [promptFormData, setPromptFormData] = useState<PromptMakerFormData>({ idea: '', genre: 'Cinematic', angle: 'Medium Shot' });
  const [advImgFormData, setAdvImgFormData] = useState<AdvancedImageFormData>({ aspectRatio: '9:16', prompt: '', count: 1 });
  
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

  const resultsRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      getAllImagesFromDB().then(images => {
          setImageHistory(images);
      });
    } catch (e) {
      console.error("Failed to load from storage", e);
    }
  }, []);

  useEffect(() => {
    let interval: number | null = null;
    if (isLoading) {
        setLoadingMessage("Sedang memproses gambar Anda...");
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isLoading]);

  const handleCharInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setCharFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handlePromptMakerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setPromptFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  const handleAdvImgChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setAdvImgFormData(prev => ({ ...prev, [name]: name === 'count' ? parseInt(value, 10) : value }));
  };

  // ============================================================
  // HELPER: Cek API key sebelum generate
  // ============================================================
  const checkApiKey = (): boolean => {
    const key = localStorage.getItem('gemini_api_key') || '';
    if (!key) {
      setError('API Key belum dimasukkan. Silakan masukkan Google AI Studio API Key kamu di bagian atas halaman.');
      setShowApiInput(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    return true;
  };

  const handleCharacterSession = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!checkApiKey()) return;
      setIsLoading(true);
      setError(null);
      setCharacterResult(null);
      try {
          const result = await generateCharacterSession(charFormData);
          setCharacterResult(result);
          await handleGenerateCharacterImageSequence(result);
      } catch (err: any) {
          setError(err.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleGenerateCharacterImageSequence = async (initialResult: CharacterResult) => {
       setCharacterResult(prev => prev ? { ...prev, isLoadingA: true, errorA: undefined } : initialResult);
       try {
           const imageA_Base64 = await generateImage(initialResult.promptA, charFormData.aspectRatio);
           const resultWithA = { ...initialResult, imageA: imageA_Base64, isLoadingA: false };
           setCharacterResult(prev => prev ? { ...prev, imageA: imageA_Base64, isLoadingA: false } : resultWithA);
           handleGenerateSideView(resultWithA, imageA_Base64);
       } catch (err: any) {
           setCharacterResult(prev => prev ? { ...prev, errorA: err.message, isLoadingA: false } : initialResult);
       }
  };

  const handleGenerateSideView = async (currentResult: CharacterResult, refImageBase64: string) => {
      setCharacterResult(prev => prev ? { ...prev, isLoadingB: true, errorB: undefined } : currentResult);
      try {
           const imageB_Base64 = await generateImage(
               currentResult.promptB, 
               charFormData.aspectRatio, 
               { data: refImageBase64, mimeType: 'image/png' }, 
               'pose-background'
           );
           setCharacterResult(prev => prev ? { ...prev, imageB: imageB_Base64, isLoadingB: false } : null);
      } catch (err: any) {
           setCharacterResult(prev => prev ? { ...prev, errorB: err.message, isLoadingB: false } : null);
      }
  };

  const handlePromptMaker = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!checkApiKey()) return;
      setIsLoading(true);
      setError(null);
      try {
          const result = await generateCreativeImagePrompts(promptFormData);
          setPromptMakerResult(result);
      } catch (err: any) {
          setError(err.message);
      } finally {
          setIsLoading(false);
      }
  };

  const handleAdvancedImageGen = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!checkApiKey()) return;
      setIsLoading(true);
      setError(null);
      setAdvancedImageResults([]);
      try {
          const results = await generateAdvancedImages(advImgFormData);
          setAdvancedImageResults(results);
          for (const res of results) {
              await saveImageToDB(res);
          }
          const newHistory = await getAllImagesFromDB();
          setImageHistory(newHistory.slice(0, 50));
      } catch (err: any) {
          setError(err.message);
      } finally {
          setIsLoading(false);
      }
  };
  
  const handleAdvImageUpload = (slot: keyof AdvancedImageFormData, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
        const result = reader.result as string;
        setEditingImage({ data: result.split(',')[1], mimeType: file.type, aspectRatio: advImgFormData.aspectRatio });
        setEditingSlot(slot);
        if(fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, slot: keyof AdvancedImageFormData) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverSlot(slot);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverSlot(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, slot: keyof AdvancedImageFormData) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverSlot(null);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
          handleAdvImageUpload(slot, file);
      }
  };

  const handleDownloadReference = (base64: string, mimeType: string) => {
        const blob = base64ToBlob(base64, 'application/octet-stream');
        forceDownload(blob, `referensi_model_${Date.now()}.png`);
  };

  const handleAdjustReference = (slot?: keyof AdvancedImageFormData) => {
      if (slot) {
          const ref = advImgFormData[slot];
          if (ref) {
              setEditingImage({ data: ref.data, mimeType: ref.mimeType, aspectRatio: advImgFormData.aspectRatio });
              setEditingSlot(slot);
          }
      }
  };

  const handleResetReference = (slot?: keyof AdvancedImageFormData) => {
      if (slot) {
          setAdvImgFormData(prev => ({ ...prev, [slot]: undefined }));
      }
  };

  const handleCropComplete = async (croppedImage: { data: string; mimeType: string }) => {
    if (editingResultId) {
        const updatedResults = advancedImageResults.map(res => {
            if (res.id === editingResultId) {
                return { ...res, base64: croppedImage.data };
            }
            return res;
        });
        setAdvancedImageResults(updatedResults);
        const targetImage = updatedResults.find(r => r.id === editingResultId);
        if (targetImage) {
            await saveImageToDB(targetImage);
            const newHistory = await getAllImagesFromDB();
            setImageHistory(newHistory.slice(0, 50));
        }
        setEditingResultId(null);
    } else if (editingSlot) {
        setAdvImgFormData(prev => ({ ...prev, [editingSlot]: croppedImage }));
        setEditingSlot(null);
    }
    setEditingImage(null);
    if(fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const handleCropCancel = () => {
    setEditingImage(null);
    setEditingSlot(null);
    setEditingResultId(null);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadImagePlusPrompt = (result: AdvancedImageResult) => {
      const safeName = sanitizeFilename(result.filename);
      const promptContent = `PROMPT:\n${result.prompt}\n\nVIDEO PROMPT (I2V):\n${result.videoPrompt || 'Tidak ada video prompt.'}`;
      const textBlob = new Blob([promptContent], { type: 'application/octet-stream' });
      forceDownload(textBlob, `${safeName}_prompt.txt`);
      setTimeout(() => {
          const imgBlob = base64ToBlob(result.base64, 'application/octet-stream');
          forceDownload(imgBlob, `${safeName}.png`);
      }, 800);
  };
  
  const deleteImageHistoryItem = async (id: string) => {
      await deleteImageFromDB(id);
      const newHistory = await getAllImagesFromDB();
      setImageHistory(newHistory.slice(0, 50));
  };

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

      {/* ===== HEADER ===== */}
      <header className="text-center mb-6 w-full max-w-7xl">
        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500 pb-2 px-1">AkariuPhoto</h1>
        <p className="text-slate-400 mt-2">
          Copywriter & Sutradara Visual{' '}
          <a 
            href="https://akariu.blogspot.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            https://akariu.blogspot.com/
          </a>
        </p>

        {/* ===== PANEL API KEY ===== */}
        <div className="mt-4 bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-left">
          {showApiInput ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔑</span>
                <p className="text-sm font-semibold text-slate-200">Masukkan Google AI Studio API Key</p>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aplikasi ini membutuhkan API Key dari Google AI Studio. Dapatkan gratis di{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  aistudio.google.com/app/apikey
                </a>
                .
              </p>
              <div className="flex items-center gap-2 bg-green-900/30 border border-green-700/50 rounded-lg px-3 py-2">
                <span className="text-green-400 text-sm">🔒</span>
                <p className="text-xs text-green-300">
                  <span className="font-semibold"></span> API Key Anda hanya disimpan di browser anda sendiri (localStorage) dan langsung dikirim ke Google. Selama akun google anda tidak terhubung dengan pembayaran penggunan hanya mengikuti FREE QUOTA dari Google, API Key di Buat di Google Aistudio dan dapat di hapus kapan saja dari akun Google anda. Tidak ada server pihak ketiga yang menyimpan atau membaca key anda.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
                  placeholder="Paste API Key di sini... (AIzaSy...)"
                  className="flex-grow bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-md text-sm transition-colors whitespace-nowrap"
                >
                  Simpan Key
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✅</span>
                <p className="text-sm text-green-300 font-medium">API Key tersimpan di browser kamu</p>
              </div>
              <button
                onClick={handleClearApiKey}
                className="text-xs text-slate-400 hover:text-red-400 underline transition-colors"
              >
                Ganti / Hapus Key
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ===== TAB NAVIGASI ===== */}
      <div className="w-full max-w-7xl mb-4">
        <div className="grid grid-cols-4 gap-1 bg-slate-700 p-1 rounded-lg">
          {(['character', 'generate', 'prompt-maker', 'collage'] as ImageTab[]).map(t => (
            <button
              type="button"
              key={t}
              onClick={() => setImageTab(t)}
              className={`px-2 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors duration-200 ${
                imageTab === t ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-600/50'
              }`}
            >
              {t === 'character'     ? 'Buat Karakter'
              : t === 'generate'    ? 'Buat Gambar'
              : t === 'prompt-maker'? 'Buat Prompt'
              : 'Kolase'}
            </button>
          ))}
        </div>
      </div>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- FORM COLUMN --- */}
        <div className={`lg:col-span-4 space-y-6 ${imageTab === 'collage' ? 'hidden' : ''}`}>
          <form
            onSubmit={
              imageTab === 'character'     ? handleCharacterSession :
              imageTab === 'prompt-maker'  ? handlePromptMaker :
              handleAdvancedImageGen
            }
            className="bg-slate-800/50 rounded-xl p-6 space-y-6"
          >
            <div className="space-y-6 animate-fade-in">

              {imageTab === 'character' && (
                <fieldset className="space-y-4" disabled={isLoading}>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Region / Race</label>
                    <select name="region" value={charFormData.region} onChange={handleCharInputChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white mb-2">
                      {MODEL_REGIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      <option value="others">Lainnya (Input Manual)</option>
                    </select>
                    {charFormData.region === 'others' && (
                      <input 
                        name="customRegion" 
                        value={charFormData.customRegion || ''} 
                        onChange={handleCharInputChange} 
                        placeholder="Ketik manual wilayah/ras... (cth: Skandinavia, Indian, dll)"
                        className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white animate-fade-in"
                      />
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Framing / Shot Type</label>
                    <div className="grid grid-cols-3 gap-2 bg-slate-700 p-1 rounded-lg">
                      {CHARACTER_FRAMINGS.map(f => (
                        <button 
                          type="button" 
                          key={f.id} 
                          onClick={() => setCharFormData(prev => ({...prev, framing: f.id}))}
                          className={`px-2 py-2 rounded-md text-xs font-semibold transition-colors duration-200 flex flex-col items-center justify-center text-center h-full ${charFormData.framing === f.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-600/50'}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Deskripsi Tambahan / Ciri Khas (Opsional)</label>
                    <textarea 
                      name="userDescription" 
                      value={charFormData.userDescription || ''} 
                      onChange={handleCharInputChange} 
                      placeholder="Cth: Memakai hijab pashmina warna pastel, kacamata bulat, gaya fashion casual..." 
                      rows={2}
                      className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white"
                    />
                    <p className="text-xs text-slate-400 mt-1">Gunakan ini untuk request spesifik (Hijab, Warna Rambut, Gaya Baju, dll).</p>
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
                  <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 flex items-center justify-center gap-2">{isLoading ? 'Membuat Karakter...' : 'Generate Character'}</button>
                </fieldset>
              )}

              {imageTab === 'prompt-maker' && (
                <fieldset className="space-y-4" disabled={isLoading}>
                  <div><label className="block text-sm font-medium text-slate-300 mb-1">Ide Sederhana</label><textarea name="idea" value={promptFormData.idea} onChange={handlePromptMakerChange} rows={3} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" placeholder="Contoh: Kucing cyberpunk minum kopi di neon city" /></div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Genre Visual</label>
                    <select name="genre" value={promptFormData.genre} onChange={handlePromptMakerChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white">
                      {VISUAL_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Camera Angle</label>
                    <select name="angle" value={promptFormData.angle} onChange={handlePromptMakerChange} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white">
                      {CAMERA_ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 flex items-center justify-center gap-2">{isLoading ? 'Membuat Prompt...' : 'Buat Prompt'}</button>
                </fieldset>
              )}

              {imageTab === 'generate' && (
                <fieldset className="space-y-4" disabled={isLoading}>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Prompt / Deskripsi</label>
                    <textarea name="prompt" value={advImgFormData.prompt} onChange={handleAdvImgChange} rows={4} className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-2 text-white" placeholder="Deskripsikan gambar yang ingin dibuat..." />
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

                  <div className="space-y-3 pt-4 border-t border-slate-700/50">
                    <label className="block text-sm font-medium text-slate-300">Referensi Gambar (Drag & Drop)</label>
                    <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleAdvImageUpload(editingSlot!, e.target.files[0]);
                      }
                    }} />
                    
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { key: 'refModel',   label: 'Model Utama' },
                        { key: 'refTop',     label: 'Atasan (Opsional)' },
                        { key: 'refBottom',  label: 'Bawahan (Opsional)' },
                        { key: 'refProduct', label: 'Produk Lain' }
                      ] as const).map((slot) => (
                        <div 
                          key={slot.key} 
                          className={`relative overflow-hidden rounded-lg cursor-pointer transition-colors ${aspectRatioClasses[advImgFormData.aspectRatio]} ${advImgFormData[slot.key] ? 'border-indigo-500 bg-black' : dragOverSlot === slot.key ? 'border-2 border-dashed border-indigo-400 bg-slate-700' : 'border-2 border-dashed border-slate-600 hover:bg-slate-700/50 flex flex-col items-center justify-center'}`}
                          onDragOver={(e) => handleDragOver(e, slot.key)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, slot.key)}
                        >
                          {advImgFormData[slot.key] ? (
                            <>
                              <img src={`data:${advImgFormData[slot.key]!.mimeType};base64,${advImgFormData[slot.key]!.data}`} className="w-full h-full object-cover opacity-80" />
                              <div className="absolute top-0 left-0 bg-black/60 px-2 py-1 rounded-br text-xs text-white font-medium z-10">{slot.label}</div>
                              <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity duration-200 flex flex-wrap items-center justify-center gap-1.5 p-2">
                                <button type="button" onClick={() => handleAdjustReference(slot.key)} className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow" title="Atur Ulang"><Icon type="adjust" className="w-4 h-4" /></button>
                                <button type="button" onClick={() => handleDownloadReference(advImgFormData[slot.key]!.data, advImgFormData[slot.key]!.mimeType)} className="p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded shadow" title="Download"><Icon type="download" className="w-4 h-4" /></button>
                                <button type="button" onClick={() => { setEditingSlot(slot.key); fileInputRef.current?.click(); }} className="p-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded shadow" title="Ganti"><Icon type="edit" className="w-4 h-4" /></button>
                                <button type="button" onClick={() => handleResetReference(slot.key)} className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded shadow" title="Hapus"><Icon type="trash" className="w-4 h-4" /></button>
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
                  </div>

                  <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 flex items-center justify-center gap-2">{isLoading ? 'Memproses Gambar...' : 'Buat Gambar'}</button>
                </fieldset>
              )}

            </div>
          </form>
        </div>

        {/* --- RESULTS COLUMN --- */}
        <div className={`${imageTab === 'collage' ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-8`}>

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
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon type="sparkles" className="w-6 h-6 text-indigo-400" />
                </div>
              </div>
              <p className="text-lg font-medium text-slate-300">{loadingMessage}</p>
            </div>
          )}

          {imageTab === 'collage' && <CollageEditor />}

          <div className="space-y-8">

            {/* Character Results */}
            {imageTab === 'character' && characterResult && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-4">Hasil Karakter</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-400">Tampak Depan (Portrait)</p>
                    <div className={`relative bg-black rounded-lg overflow-hidden ${aspectRatioClasses[charFormData.aspectRatio]}`}>
                      {characterResult.isLoadingA ? (
                        <div className="absolute inset-0 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
                      ) : characterResult.imageA ? (
                        <img src={`data:image/png;base64,${characterResult.imageA}`} alt="Character A" className="w-full h-full object-cover" />
                      ) : characterResult.errorA ? (
                        <div className="absolute inset-0 flex items-center justify-center p-4 text-red-400 text-xs text-center">{characterResult.errorA}</div>
                      ) : null}
                      {characterResult.imageA && (
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button onClick={() => handleDownloadReference(characterResult.imageA!, 'image/png')} className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70"><Icon type="download" className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-400">Tampak Samping / Gaya Lain</p>
                    <div className={`relative bg-black rounded-lg overflow-hidden ${aspectRatioClasses[charFormData.aspectRatio]}`}>
                      {characterResult.isLoadingB ? (
                        <div className="absolute inset-0 flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
                      ) : characterResult.imageB ? (
                        <img src={`data:image/png;base64,${characterResult.imageB}`} alt="Character B" className="w-full h-full object-cover" />
                      ) : characterResult.errorB ? (
                        <div className="absolute inset-0 flex items-center justify-center p-4 text-red-400 text-xs text-center">{characterResult.errorB}</div>
                      ) : null}
                      {characterResult.imageB && (
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button onClick={() => handleDownloadReference(characterResult.imageB!, 'image/png')} className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70"><Icon type="download" className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-slate-900/50 rounded-lg">
                  <p className="text-xs text-slate-400 font-mono mb-1">Character Description:</p>
                  <p className="text-sm text-slate-300">{characterResult.summary}</p>
                </div>
              </div>
            )}
            
            {/* Prompt Maker Results */}
            {imageTab === 'prompt-maker' && promptMakerResult && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
                <h3 className="text-lg font-bold text-white">Hasil Prompt</h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-indigo-400">Prompt Bahasa Indonesia (Artistik)</label>
                  <div className="bg-slate-900/50 p-3 rounded-lg flex gap-3">
                    <p className="text-sm text-slate-300 flex-grow">{promptMakerResult.indoPrompt}</p>
                    <button onClick={() => navigator.clipboard.writeText(promptMakerResult.indoPrompt)} className="text-slate-400 hover:text-white"><Icon type="copy" className="w-5 h-5" /></button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-indigo-400">Prompt English (AI Optimized)</label>
                  <div className="bg-slate-900/50 p-3 rounded-lg flex gap-3">
                    <p className="text-sm text-slate-300 flex-grow">{promptMakerResult.engPrompt}</p>
                    <button onClick={() => navigator.clipboard.writeText(promptMakerResult.engPrompt)} className="text-slate-400 hover:text-white"><Icon type="copy" className="w-5 h-5" /></button>
                  </div>
                </div>
              </div>
            )}

            {/* Advanced Image Results */}
            {advancedImageResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {advancedImageResults.map((res) => (
                  <div key={res.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 relative group">
                    <div className={`w-full ${aspectRatioClasses[res.aspectRatio]} bg-black relative`}>
                      <img src={`data:image/png;base64,${res.base64}`} alt={res.prompt} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={() => handleDownloadImagePlusPrompt(res)} className="p-2 bg-slate-700 text-white rounded-full hover:bg-indigo-600" title="Download Image + Prompt"><Icon type="download" className="w-5 h-5" /></button>
                        <button 
                          onClick={() => {
                            setEditingResultId(res.id);
                            setEditingImage({ data: res.base64, mimeType: 'image/png', aspectRatio: res.aspectRatio });
                          }} 
                          className="p-2 bg-slate-700 text-white rounded-full hover:bg-indigo-600" 
                          title="Edit / Crop"
                        >
                          <Icon type="adjust" className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-xs text-slate-400 line-clamp-2 mb-2">{res.prompt}</p>
                      {res.videoPrompt && (
                        <div className="bg-slate-900/50 p-2 rounded relative">
                          <div className="flex justify-between items-start">
                            <p className="text-[10px] text-indigo-300 font-bold mb-1">VIDEO PROMPT:</p>
                            <button onClick={() => navigator.clipboard.writeText(res.videoPrompt!)} className="text-slate-400 hover:text-white" title="Salin Prompt Video">
                              <Icon type="copy" className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-3">{res.videoPrompt}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Image History */}
            {imageHistory.length > 0 && (
              <div className="pt-8 border-t border-slate-700">
                <h2 className="text-xl font-bold text-slate-400 mb-6 flex items-center gap-2">
                  <Icon type="history" className="w-5 h-5" />
                  Galeri Riwayat
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                  {imageHistory.map(img => (
                    <div key={img.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 relative group">
                      <div className={`w-full ${aspectRatioClasses[img.aspectRatio]} bg-black relative`}>
                        <img src={`data:image/png;base64,${img.base64}`} className="w-full h-full object-cover" alt={img.prompt} />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button onClick={() => handleDownloadImagePlusPrompt(img)} className="p-2 bg-slate-700 text-white rounded-full hover:bg-indigo-600" title="Download"><Icon type="download" className="w-5 h-5" /></button>
                          <button onClick={() => deleteImageHistoryItem(img.id)} className="p-2 bg-slate-700 text-white rounded-full hover:bg-red-600" title="Hapus"><Icon type="trash" className="w-5 h-5" /></button>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-slate-400 line-clamp-2 mb-2" title={img.prompt}>{img.prompt}</p>
                        {img.videoPrompt && (
                          <div className="bg-slate-900/50 p-2 rounded relative">
                            <div className="flex justify-between items-start">
                              <p className="text-[10px] text-indigo-300 font-bold mb-1">VIDEO PROMPT:</p>
                              <button onClick={() => navigator.clipboard.writeText(img.videoPrompt!)} className="text-slate-400 hover:text-white" title="Salin Prompt Video">
                                <Icon type="copy" className="w-3 h-3" />
                              </button>
                            </div>
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
