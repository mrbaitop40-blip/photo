import React, { useState, useRef, useCallback } from 'react';
import { GroupPerson, GroupPhotoFormData, GroupPhotoResult, AspectRatio, ScenePreset } from '../types';
import { SCENE_PRESETS, SCENE_PRESET_CATEGORIES, FRAMING_OPTIONS } from '../constants';
import { generateGroupPhoto } from '../services/geminiService';
import Icon from './Icon';

// ── Helper ──
const base64ToBlob = (base64: string, mimeType: string) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
};
const forceDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.setAttribute('download', filename);
  document.body.appendChild(a); a.click();
  requestAnimationFrame(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); });
};

const aspectRatioClasses: Record<AspectRatio, string> = {
  '9:16': 'aspect-[9/16]', '16:9': 'aspect-[16/9]', '1:1': 'aspect-square',
  '2:3': 'aspect-[2/3]', '3:4': 'aspect-[3/4]', '4:3': 'aspect-[4/3]', '4:5': 'aspect-[4/5]',
};

const MAX_PERSONS = 6;

const createEmptyPerson = (id: string): GroupPerson => ({
  id, label: '', age: '', image: undefined,
});

// ── Label sugesti berdasarkan index ──
const LABEL_SUGGESTIONS = ['Ayah', 'Bunda', 'Kakak', 'Adik', 'Nenek', 'Kakek'];

// ── Warna badge tiap slot ──
const SLOT_COLORS = [
  'border-indigo-500/60 bg-indigo-950/20',
  'border-purple-500/60 bg-purple-950/20',
  'border-pink-500/60 bg-pink-950/20',
  'border-amber-500/60 bg-amber-950/20',
  'border-emerald-500/60 bg-emerald-950/20',
  'border-sky-500/60 bg-sky-950/20',
];
const SLOT_DOT_COLORS = [
  'bg-indigo-400', 'bg-purple-400', 'bg-pink-400',
  'bg-amber-400', 'bg-emerald-400', 'bg-sky-400',
];

// ──────────────────────────────────────────────
// PERSON SLOT CARD
// ──────────────────────────────────────────────
interface PersonSlotProps {
  person: GroupPerson;
  index: number;
  onUpdate: (id: string, patch: Partial<GroupPerson>) => void;
  onRemoveImage: (id: string) => void;
}

const PersonSlot: React.FC<PersonSlotProps> = ({ person, index, onUpdate, onRemoveImage }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      onUpdate(person.id, { image: { data: result.split(',')[1], mimeType: file.type } });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className={`rounded-xl border p-3 space-y-2.5 transition-all ${SLOT_COLORS[index]}`}>
      {/* Header slot */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${SLOT_DOT_COLORS[index]}`} />
        <span className="text-xs font-bold text-slate-300">Orang {index + 1}</span>
      </div>

      {/* Upload area */}
      <div
        className={`relative rounded-lg overflow-hidden aspect-square cursor-pointer border-2 border-dashed transition-all ${
          dragOver ? 'border-indigo-400 bg-slate-700' : person.image ? 'border-transparent' : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => !person.image && fileRef.current?.click()}
      >
        <input type="file" accept="image/*" ref={fileRef} className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }} />

        {person.image ? (
          <>
            <img src={`data:${person.image.mimeType};base64,${person.image.data}`}
              className="w-full h-full object-cover" alt={person.label || `Orang ${index + 1}`} />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
              <button type="button" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs">
                Ganti Foto
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); onRemoveImage(person.id); }}
                className="px-2 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded text-xs">
                Hapus
              </button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
            <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span className="text-[10px] text-slate-500 text-center leading-tight">
              {dragOver ? 'Lepaskan!' : 'Klik / drag foto'}
            </span>
          </div>
        )}
      </div>

      {/* Label */}
      <input
        type="text"
        value={person.label}
        onChange={e => onUpdate(person.id, { label: e.target.value })}
        placeholder={LABEL_SUGGESTIONS[index] || `Label`}
        className="w-full bg-slate-800 border border-slate-600/50 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-500"
      />

      {/* Usia */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={person.age}
          onChange={e => onUpdate(person.id, { age: e.target.value === '' ? '' : parseInt(e.target.value) })}
          placeholder="Usia"
          min={0} max={100}
          className="w-full bg-slate-800 border border-slate-600/50 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-500"
        />
        <span className="text-xs text-slate-500 whitespace-nowrap">thn</span>
      </div>

      {/* Petunjuk usia */}
      {typeof person.age === 'number' && person.age >= 0 && (
        <div className={`text-[9px] px-1.5 py-1 rounded text-center leading-tight ${
          person.age === 0 ? 'bg-pink-900/30 text-pink-300' :
          person.age <= 6  ? 'bg-amber-900/30 text-amber-300' :
          person.age <= 12 ? 'bg-sky-900/30 text-sky-300' :
          'bg-slate-700/50 text-slate-400'
        }`}>
          {person.age === 0 ? '👶 Bayi — digendong' :
           person.age <= 2  ? '🧒 Balita ~45-50% tinggi dewasa' :
           person.age <= 6  ? `🧒 Anak kecil ~${person.age <= 4 ? 55 : 60}% tinggi dewasa` :
           person.age <= 12 ? `🧒 Anak ~${person.age <= 8 ? 65 : person.age <= 10 ? 70 : 75}% tinggi dewasa` :
           person.age <= 17 ? `🧑 Remaja ~${person.age <= 14 ? 82 : person.age <= 16 ? 88 : 93}% tinggi dewasa` :
           '🧑 Dewasa penuh'}
        </div>
      )}
    </div>
  );
};


// ──────────────────────────────────────────────
// PRESET PICKER (khusus untuk Foto Grup)
// ──────────────────────────────────────────────
interface PresetPickerProps {
  selected: ScenePreset | null;
  onSelect: (preset: ScenePreset) => void;
  onClear: () => void;
}

const PresetPicker: React.FC<PresetPickerProps> = ({ selected, onSelect, onClear }) => {
  const [open, setOpen] = useState(false);
  // Filter hanya preset yang relevan untuk foto grup
  const groupPresets = SCENE_PRESETS.filter(p =>
    ['Islami', 'Event', 'Fashion'].includes(p.category)
  );
  const cats = [...new Set(groupPresets.map(p => p.category))];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">Scene Preset (Opsional)</label>
        <button type="button" onClick={() => setOpen(o => !o)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          {open ? 'Sembunyikan ▲' : 'Pilih Preset ▼'}
        </button>
      </div>

      {open && (
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-3 max-h-52 overflow-y-auto">
          {cats.map(cat => (
            <div key={cat}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{cat}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {groupPresets.filter(p => p.category === cat).map(preset => (
                  <button key={preset.id} type="button"
                    onClick={() => { onSelect(preset); setOpen(false); }}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg text-left text-xs transition-all border ${
                      selected?.id === preset.id
                        ? 'border-indigo-500 bg-indigo-600/20 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-indigo-500/50'
                    }`}
                  >
                    <span className="text-sm">{preset.icon}</span>
                    <span className="font-medium leading-tight">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="flex items-center justify-between bg-indigo-950/40 border border-indigo-600/30 rounded-lg px-3 py-1.5">
          <span className="text-xs text-indigo-300">{selected.icon} Preset: <strong>{selected.label}</strong></span>
          <button type="button" onClick={onClear} className="text-xs text-slate-400 hover:text-red-400 ml-2">✕</button>
        </div>
      )}
    </div>
  );
};


// ──────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────
const GroupPhotoEditor: React.FC = () => {
  const [persons, setPersons] = useState<GroupPerson[]>([
    createEmptyPerson('p1'),
    createEmptyPerson('p2'),
  ]);
  const [scene, setScene] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [framing, setFraming] = useState<'auto' | 'close_up' | 'medium' | 'full_body' | 'wide'>('full_body');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GroupPhotoResult[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<ScenePreset | null>(null);

  const filledCount = persons.filter(p => p.image).length;

  const updatePerson = useCallback((id: string, patch: Partial<GroupPerson>) => {
    setPersons(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }, []);

  const removeImage = useCallback((id: string) => {
    setPersons(prev => prev.map(p => p.id === id ? { ...p, image: undefined } : p));
  }, []);

  const addPerson = () => {
    if (persons.length >= MAX_PERSONS) return;
    setPersons(prev => [...prev, createEmptyPerson(`p${Date.now()}`)]);
  };

  const removePerson = (id: string) => {
    if (persons.length <= 1) return;
    setPersons(prev => prev.filter(p => p.id !== id));
  };

  const handleSelectPreset = (preset: ScenePreset) => {
    setSelectedPreset(preset);
    setScene(preset.prompt);
  };

  const handleClearPreset = () => {
    setSelectedPreset(null);
    setScene('');
  };

  const handleGenerate = async () => {
    const apiKey = localStorage.getItem('gemini_api_key') || '';
    if (!apiKey) {
      setError('API Key belum dimasukkan. Silakan masukkan di bagian atas halaman.');
      return;
    }
    if (filledCount === 0) {
      setError('Upload minimal 1 foto orang untuk membuat foto grup.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const base64 = await generateGroupPhoto({ persons, scene, aspectRatio, framing });
      const result: GroupPhotoResult = {
        id: `grp_${Date.now()}`,
        base64,
        scene,
        timestamp: Date.now(),
        aspectRatio,
      };
      setResults(prev => [result, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Gagal membuat foto grup.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (result: GroupPhotoResult) => {
    forceDownload(base64ToBlob(result.base64, 'application/octet-stream'), `foto_grup_${result.id}.png`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

      {/* ── PANEL KIRI: Form ── */}
      <div className="lg:col-span-4 space-y-5">
        <div className="bg-slate-800/50 rounded-xl p-5 space-y-5">

          {/* Title */}
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>👨‍👩‍👧‍👦</span> Foto Grup / Keluarga
            </h2>
            <p className="text-xs text-slate-400 mt-1">Upload foto tiap orang, isi nama & usia, lalu describe scene. AI akan menyesuaikan proporsi tinggi secara otomatis.</p>
          </div>

          {/* Aspek Rasio */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Aspek Rasio</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['16:9', '9:16', '1:1', '4:3'] as AspectRatio[]).map(r => (
                <button key={r} type="button" onClick={() => setAspectRatio(r)}
                  className={`py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    aspectRatio === r ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >{r}</button>
              ))}
            </div>
          </div>

          {/* Framing */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Framing / Jarak Kamera
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {FRAMING_OPTIONS.map(f => (
                <button key={f.id} type="button"
                  onClick={() => setFraming(f.id as any)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 text-center transition-all ${
                    framing === f.id
                      ? 'border-indigo-500 bg-indigo-600/25 shadow-lg shadow-indigo-500/10'
                      : 'border-slate-600/60 bg-slate-700/40 hover:border-indigo-500/50'
                  }`}
                >
                  <span className="text-base leading-none">{f.icon}</span>
                  <span className={`text-[10px] font-bold leading-tight ${framing === f.id ? 'text-white' : 'text-slate-300'}`}>
                    {f.label}
                  </span>
                  <span className="text-[9px] text-slate-500 leading-tight hidden sm:block">{f.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              💡 Untuk foto grup, <span className="text-slate-400 font-medium">Full Body</span> atau <span className="text-slate-400 font-medium">Wide Shot</span> direkomendasikan agar semua anggota terlihat.
            </p>
          </div>

          {/* Preset Scene */}
          <PresetPicker selected={selectedPreset} onSelect={handleSelectPreset} onClear={handleClearPreset} />

          {/* Scene description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Deskripsi Scene
            </label>
            <textarea
              value={scene}
              onChange={e => { setScene(e.target.value); if (selectedPreset) setSelectedPreset(null); }}
              rows={3}
              placeholder="Cth: Foto keluarga di ruang tamu yang nyaman, suasana lebaran, semua berpakaian batik, pencahayaan hangat..."
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder-slate-500 resize-none"
            />
            <p className="text-xs text-slate-500 mt-1">Kosongkan untuk biarkan AI memilih scene yang natural.</p>
          </div>

          {/* Person slots */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-300">
                Anggota Grup
                <span className="ml-2 text-xs text-slate-500">({filledCount}/{persons.length} foto terisi)</span>
              </label>
              {persons.length < MAX_PERSONS && (
                <button type="button" onClick={addPerson}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">
                  <span>+</span> Tambah Orang
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {persons.map((person, idx) => (
                <div key={person.id} className="relative">
                  <PersonSlot
                    person={person}
                    index={idx}
                    onUpdate={updatePerson}
                    onRemoveImage={removeImage}
                  />
                  {persons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePerson(person.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 hover:bg-red-500 text-white rounded-full text-xs flex items-center justify-center shadow-lg transition-colors z-10"
                      title="Hapus slot"
                    >✕</button>
                  )}
                </div>
              ))}

              {/* Tombol tambah orang (di dalam grid) */}
              {persons.length < MAX_PERSONS && (
                <button type="button" onClick={addPerson}
                  className="rounded-xl border-2 border-dashed border-slate-600 hover:border-indigo-500/50 bg-slate-800/30 hover:bg-slate-700/30 transition-all aspect-square flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-slate-400">
                  <span className="text-2xl">+</span>
                  <span className="text-[10px]">Tambah<br/>Orang</span>
                </button>
              )}
            </div>

            {persons.length >= MAX_PERSONS && (
              <p className="text-xs text-amber-400/80 text-center mt-2">Maksimal {MAX_PERSONS} orang per foto.</p>
            )}
          </div>

          {/* Info proportional height */}
          <div className="bg-slate-900/40 border border-slate-700/40 rounded-lg p-3 space-y-1">
            <p className="text-xs font-semibold text-slate-400">ℹ️ Proporsi tinggi otomatis:</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {[
                ['👶 Bayi (0)', 'Digendong'],
                ['🧒 Balita (1-2)', '~45-50%'],
                ['🧒 Anak (3-6)', '~55-60%'],
                ['🧒 Anak (7-12)', '~65-75%'],
                ['🧑 Remaja (13-17)', '~82-93%'],
                ['🧑 Dewasa (18+)', '100%'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-[10px] text-slate-500">
                  <span>{label}</span><span className="text-slate-400 font-mono">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-3 rounded-lg text-xs">
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading || filledCount === 0}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Sedang membuat foto grup...
              </>
            ) : (
              <>
                <span>✨</span>
                Generate Foto Grup
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── PANEL KANAN: Results ── */}
      <div className="lg:col-span-8 space-y-6">

        {/* Loading */}
        {isLoading && (
          <div className="bg-slate-800 rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl">👨‍👩‍👧‍👦</span>
              </div>
            </div>
            <div>
              <p className="text-lg font-medium text-slate-300">Membuat foto grup...</p>
              <p className="text-xs text-slate-500 mt-1">AI sedang menyesuaikan wajah dan proporsi tinggi setiap orang</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && results.length === 0 && (
          <div className="bg-slate-800/50 rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-3 border-2 border-dashed border-slate-700">
            <span className="text-5xl">👨‍👩‍👧‍👦</span>
            <p className="text-slate-400 font-medium">Hasil foto grup akan muncul di sini</p>
            <p className="text-xs text-slate-500">Upload foto tiap anggota, isi usia, lalu klik Generate</p>
          </div>
        )}

        {/* Results grid */}
        {results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {results.map(result => (
              <div key={result.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 group">
                <div className={`w-full ${aspectRatioClasses[result.aspectRatio]} bg-black relative`}>
                  <img
                    src={`data:image/png;base64,${result.base64}`}
                    alt="Foto Grup"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleDownload(result)}
                      className="p-2 bg-slate-700 text-white rounded-full hover:bg-indigo-600 transition-colors"
                      title="Download"
                    >
                      <Icon type="download" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {result.scene || 'Foto grup natural'}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {new Date(result.timestamp).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupPhotoEditor;
