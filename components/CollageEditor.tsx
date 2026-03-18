import React, { useState, useRef, useEffect, useCallback } from 'react';

// =============================================
// TYPES
// =============================================
interface CollageCell {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CollageLayout {
  id: string;
  name: string;
  photoCount: number;
  cells: CollageCell[];
}

interface CellState {
  imageSrc: string | null;
  imgNaturalW: number;  // ← BARU: simpan dimensi asli gambar
  imgNaturalH: number;  // ← BARU
  scale: number;   // 1 = contain (gambar penuh), > 1 = zoom in
  offsetX: number; // fraksi dari cellW (bukan px) → 0.0 = center
  offsetY: number; // fraksi dari cellH → 0.0 = center
}

// =============================================
// LAYOUTS
// =============================================
const COLLAGE_LAYOUTS: CollageLayout[] = [
  // 2 FOTO
  { id:'2_lr_50', name:'50/50 Kiri-Kanan',  photoCount:2, cells:[{x:0,y:0,w:50,h:100},{x:50,y:0,w:50,h:100}] },
  { id:'2_tb_50', name:'50/50 Atas-Bawah',  photoCount:2, cells:[{x:0,y:0,w:100,h:50},{x:0,y:50,w:100,h:50}] },
  { id:'2_lr_60', name:'60/40 Kiri-Kanan',  photoCount:2, cells:[{x:0,y:0,w:60,h:100},{x:60,y:0,w:40,h:100}] },
  { id:'2_lr_70', name:'70/30 Kiri-Kanan',  photoCount:2, cells:[{x:0,y:0,w:70,h:100},{x:70,y:0,w:30,h:100}] },
  { id:'2_tb_65', name:'65/35 Atas-Bawah',  photoCount:2, cells:[{x:0,y:0,w:100,h:65},{x:0,y:65,w:100,h:35}] },
  // 3 FOTO
  { id:'3_1l_2r', name:'1 Besar Kiri + 2 Kanan',     photoCount:3, cells:[{x:0,y:0,w:55,h:100},{x:55,y:0,w:45,h:50},{x:55,y:50,w:45,h:50}] },
  { id:'3_2l_1r', name:'2 Kiri + 1 Besar Kanan',     photoCount:3, cells:[{x:0,y:0,w:45,h:50},{x:0,y:50,w:45,h:50},{x:45,y:0,w:55,h:100}] },
  { id:'3_1t_2b', name:'1 Besar Atas + 2 Bawah',     photoCount:3, cells:[{x:0,y:0,w:100,h:55},{x:0,y:55,w:50,h:45},{x:50,y:55,w:50,h:45}] },
  { id:'3_2t_1b', name:'2 Atas + 1 Besar Bawah',     photoCount:3, cells:[{x:0,y:0,w:50,h:45},{x:50,y:0,w:50,h:45},{x:0,y:45,w:100,h:55}] },
  { id:'3_asym',  name:'1 Kiri + 2 Kanan Asimetris', photoCount:3, cells:[{x:0,y:0,w:50,h:100},{x:50,y:0,w:50,h:40},{x:50,y:40,w:50,h:60}] },
  // 4 FOTO
  { id:'4_grid',  name:'2x2 Grid Sama Rata',      photoCount:4, cells:[{x:0,y:0,w:50,h:50},{x:50,y:0,w:50,h:50},{x:0,y:50,w:50,h:50},{x:50,y:50,w:50,h:50}] },
  { id:'4_1l_3r', name:'1 Besar Kiri + 3 Kanan',  photoCount:4, cells:[{x:0,y:0,w:55,h:100},{x:55,y:0,w:45,h:33.34},{x:55,y:33.34,w:45,h:33.33},{x:55,y:66.67,w:45,h:33.33}] },
  { id:'4_3l_1r', name:'3 Kiri + 1 Besar Kanan',  photoCount:4, cells:[{x:0,y:0,w:45,h:33.34},{x:0,y:33.34,w:45,h:33.33},{x:0,y:66.67,w:45,h:33.33},{x:45,y:0,w:55,h:100}] },
  { id:'4_1t_3b', name:'1 Besar Atas + 3 Bawah',  photoCount:4, cells:[{x:0,y:0,w:100,h:55},{x:0,y:55,w:33.34,h:45},{x:33.34,y:55,w:33.33,h:45},{x:66.67,y:55,w:33.33,h:45}] },
  { id:'4_3t_1b', name:'3 Atas + 1 Besar Bawah',  photoCount:4, cells:[{x:0,y:0,w:33.34,h:45},{x:33.34,y:0,w:33.33,h:45},{x:66.67,y:0,w:33.33,h:45},{x:0,y:45,w:100,h:55}] },
  { id:'4_lg_sm', name:'1 Besar + 3 Strip Bawah',  photoCount:4, cells:[{x:0,y:0,w:100,h:65},{x:0,y:65,w:33.34,h:35},{x:33.34,y:65,w:33.33,h:35},{x:66.67,y:65,w:33.33,h:35}] },
  // 5 FOTO
  { id:'5_1tl_4',   name:'1 Pojok Besar + 4 Kecil', photoCount:5, cells:[{x:0,y:0,w:60,h:60},{x:60,y:0,w:40,h:30},{x:60,y:30,w:40,h:30},{x:0,y:60,w:50,h:40},{x:50,y:60,w:50,h:40}] },
  { id:'5_2t_3b',   name:'2 Atas + 3 Bawah',        photoCount:5, cells:[{x:0,y:0,w:50,h:50},{x:50,y:0,w:50,h:50},{x:0,y:50,w:33.34,h:50},{x:33.34,y:50,w:33.33,h:50},{x:66.67,y:50,w:33.33,h:50}] },
  { id:'5_3t_2b',   name:'3 Atas + 2 Bawah',        photoCount:5, cells:[{x:0,y:0,w:33.34,h:50},{x:33.34,y:0,w:33.33,h:50},{x:66.67,y:0,w:33.33,h:50},{x:0,y:50,w:50,h:50},{x:50,y:50,w:50,h:50}] },
  { id:'5_1l_4r',   name:'1 Besar Kiri + 4 Kanan',  photoCount:5, cells:[{x:0,y:0,w:50,h:100},{x:50,y:0,w:50,h:25},{x:50,y:25,w:50,h:25},{x:50,y:50,w:50,h:25},{x:50,y:75,w:50,h:25}] },
  { id:'5_4l_1r',   name:'4 Kiri + 1 Besar Kanan',  photoCount:5, cells:[{x:0,y:0,w:50,h:25},{x:0,y:25,w:50,h:25},{x:0,y:50,w:50,h:25},{x:0,y:75,w:50,h:25},{x:50,y:0,w:50,h:100}] },
  { id:'5_cross',   name:'Pola Plus / Cross',        photoCount:5, cells:[{x:33.33,y:0,w:33.34,h:33.33},{x:0,y:33.33,w:33.33,h:33.34},{x:33.33,y:33.33,w:33.34,h:33.34},{x:66.67,y:33.33,w:33.33,h:33.34},{x:33.33,y:66.67,w:33.34,h:33.33}] },
  { id:'5_1c_4cor', name:'1 Tengah + 4 Sudut',      photoCount:5, cells:[{x:25,y:25,w:50,h:50},{x:0,y:0,w:25,h:25},{x:75,y:0,w:25,h:25},{x:0,y:75,w:25,h:25},{x:75,y:75,w:25,h:25}] },
  // 6 FOTO
  { id:'6_2x3',  name:'6 - Grid 2x3',         photoCount:6, cells:[{x:0,y:0,w:33.34,h:50},{x:33.34,y:0,w:33.33,h:50},{x:66.67,y:0,w:33.33,h:50},{x:0,y:50,w:33.34,h:50},{x:33.34,y:50,w:33.33,h:50},{x:66.67,y:50,w:33.33,h:50}] },
  { id:'6_3x2',  name:'6 - Grid 3x2',         photoCount:6, cells:[{x:0,y:0,w:50,h:33.34},{x:50,y:0,w:50,h:33.34},{x:0,y:33.34,w:50,h:33.33},{x:50,y:33.34,w:50,h:33.33},{x:0,y:66.67,w:50,h:33.33},{x:50,y:66.67,w:50,h:33.33}] },
  { id:'6_1l5r', name:'6 - 1 Besar + 5 Strip', photoCount:6, cells:[{x:0,y:0,w:55,h:100},{x:55,y:0,w:45,h:20},{x:55,y:20,w:45,h:20},{x:55,y:40,w:45,h:20},{x:55,y:60,w:45,h:20},{x:55,y:80,w:45,h:20}] },
];

const ASPECT_OPTIONS = [
  { value:'1:1',  label:'1:1',  sub:'Square' },
  { value:'9:16', label:'9:16', sub:'Portrait' },
  { value:'16:9', label:'16:9', sub:'Landscape' },
  { value:'4:5',  label:'4:5',  sub:'Instagram' },
  { value:'3:4',  label:'3:4',  sub:'Portrait' },
  { value:'4:3',  label:'4:3',  sub:'Landscape' },
];

const BG_PRESETS = ['#000000','#ffffff','#1e293b','#0f0f0f','#4f46e5','#be185d','#b45309','#166534'];
const DEFAULT_CELL = (): CellState => ({
  imageSrc: null,
  imgNaturalW: 0,
  imgNaturalH: 0,
  scale: 1,
  offsetX: 0,   // fraksi dari cellW: -0.5 s/d +0.5
  offsetY: 0,   // fraksi dari cellH: -0.5 s/d +0.5
});

// =============================================
// CELL EDITOR
// =============================================
interface CellEditorProps {
  cs: CellState;
  idx: number;
  isDragOver: boolean;
  isSelected: boolean;
  onSelect: (i: number) => void;
  onUpdate: (i: number, patch: Partial<CellState>) => void;
  onUpload: (i: number, file: File) => void;
  onRemove: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, i: number) => void;
}

const CellEditor: React.FC<CellEditorProps> = ({
  cs, idx,
  isDragOver, isSelected,
  onSelect, onUpdate, onUpload, onRemove,
  onDragOver, onDragLeave, onDrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!cs.imageSrc) return;
    e.preventDefault();
    onSelect(idx);
    isDragging.current = true;

    const startX = e.clientX;
    const startY = e.clientY;
    const startOffX = cs.offsetX;
    const startOffY = cs.offsetY;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cellW = rect.width;
      const cellH = rect.height;

      // Hitung contain scale untuk tahu berapa batas geser yg valid
      const containScale = cs.imgNaturalW > 0 && cs.imgNaturalH > 0
        ? Math.min(cellW / cs.imgNaturalW, cellH / cs.imgNaturalH)
        : 1;
      const renderedW = cs.imgNaturalW * containScale * cs.scale;
      const renderedH = cs.imgNaturalH * containScale * cs.scale;

      // Batas geser: setengah selisih antara gambar yang sudah di-scale dengan ukuran cell
      const maxOffX = Math.max(0, (renderedW - cellW) / 2) / cellW;
      const maxOffY = Math.max(0, (renderedH - cellH) / 2) / cellH;

      const deltaFracX = (ev.clientX - startX) / cellW;
      const deltaFracY = (ev.clientY - startY) / cellH;

      onUpdate(idx, {
        offsetX: Math.max(-maxOffX, Math.min(maxOffX, startOffX + deltaFracX)),
        offsetY: Math.max(-maxOffY, Math.min(maxOffY, startOffY + deltaFracY)),
      });
    };

    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const getImgStyle = (): React.CSSProperties => {
    if (!cs.imageSrc) return { display: 'none' };
    return {
      display: 'block',
      width: '100%',
      height: '100%',
      objectFit: 'contain' as const,
      objectPosition: 'center',
      transformOrigin: 'center center',
      transform: `scale(${cs.scale}) translate(${cs.offsetX * 100}%, ${cs.offsetY * 100}%)`,
      userSelect: 'none' as const,
      pointerEvents: 'none' as const,
      willChange: 'transform',
    };
  };

  return (
    <div
      className="relative w-full h-full"
      onDragOver={e => onDragOver(e, idx)}
      onDragLeave={onDragLeave}
      onDrop={e => onDrop(e, idx)}
    >
      <div
        ref={containerRef}
        className={`
          relative w-full h-full overflow-hidden group
          ${cs.imageSrc ? (isDragging.current ? 'cursor-grabbing' : 'cursor-grab') : ''}
          ${isSelected && cs.imageSrc ? 'ring-2 ring-inset ring-indigo-500' : ''}
          ${isDragOver ? 'ring-2 ring-inset ring-indigo-400' : ''}
        `}
        style={{ background: 'rgba(15,23,42,0.9)' }}
        onMouseDown={handleMouseDown}
        onClick={() => cs.imageSrc && onSelect(idx)}
      >
        {cs.imageSrc ? (
          <>
            <img
              src={cs.imageSrc}
              alt=""
              draggable={false}
              style={getImgStyle()}
            />

            {/* Overlay kontrol */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-start justify-between p-1 pointer-events-none group-hover:pointer-events-auto">
              <span className="text-[9px] font-bold bg-indigo-600 text-white w-4 h-4 rounded-full flex items-center justify-center">{idx + 1}</span>
              <button type="button"
                onClick={e => { e.stopPropagation(); onRemove(idx); }}
                className="w-5 h-5 bg-red-600/90 hover:bg-red-500 text-white rounded text-xs flex items-center justify-center"
              >✕</button>
            </div>

            {/* Zoom badge */}
            <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-[8px] text-white/80 bg-black/60 px-1 py-0.5 rounded font-mono">
                {(cs.scale * 100).toFixed(0)}%
              </span>
            </div>
          </>
        ) : isDragOver ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v8"/>
            </svg>
            <span className="text-[10px] text-indigo-300 font-bold">Lepaskan!</span>
          </div>
        ) : (
          <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-700/30 transition-colors">
            <input type="file" accept="image/*" className="hidden"
              onChange={e => {
                if (e.target.files?.[0]) { onUpload(idx, e.target.files[0]); onSelect(idx); }
                e.target.value = '';
              }}
            />
            <svg className="w-4 h-4 text-slate-500 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4"/>
            </svg>
            <span className="text-[9px] text-slate-500">Foto {idx + 1}</span>
          </label>
        )}
      </div>
    </div>
  );
};

// =============================================
// MAIN COMPONENT
// =============================================
const CollageEditor: React.FC = () => {
  const [selectedLayout, setSelectedLayout] = useState<CollageLayout>(COLLAGE_LAYOUTS[0]);
  const [aspectRatio, setAspectRatio]       = useState('1:1');
  const [gap, setGap]                       = useState(4);
  const [bgColor, setBgColor]               = useState('#000000');
  const [cells, setCells]                   = useState<CellState[]>([DEFAULT_CELL()]);
  const [filterCount, setFilterCount]       = useState<number | null>(null);
  const [isExporting, setIsExporting]       = useState(false);
  const [dragOverCell, setDragOverCell]     = useState<number | null>(null);
  const [selectedCell, setSelectedCell]     = useState<number | null>(null);

  useEffect(() => {
    setCells(prev => selectedLayout.cells.map((_, i) => prev[i] ?? DEFAULT_CELL()));
    setSelectedCell(null);
  }, [selectedLayout]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-collage-area]')) setSelectedCell(null);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  const updateCell = useCallback((i: number, patch: Partial<CellState>) => {
    setCells(prev => prev.map((c, ci) => ci !== i ? c : { ...c, ...patch }));
  }, []);

  const handleUpload = useCallback((i: number, file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target?.result as string;
      // Baca dimensi asli gambar saat upload
      const img = new Image();
      img.onload = () => {
        updateCell(i, {
          imageSrc: src,
          imgNaturalW: img.naturalWidth,
          imgNaturalH: img.naturalHeight,
          scale: 1,
          offsetX: 0,
          offsetY: 0,
        });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [updateCell]);

  const handleRemove    = useCallback((i: number) => { updateCell(i, DEFAULT_CELL()); setSelectedCell(null); }, [updateCell]);
  const handleDragOver  = useCallback((e: React.DragEvent, i: number) => { e.preventDefault(); setDragOverCell(i); }, []);
  const handleDragLeave = useCallback(() => setDragOverCell(null), []);
  const handleDrop      = useCallback((e: React.DragEvent, i: number) => {
    e.preventDefault(); setDragOverCell(null);
    const f = e.dataTransfer.files[0];
    if (f) { handleUpload(i, f); setSelectedCell(i); }
  }, [handleUpload]);

  const getCellStyle = useCallback((cell: CollageCell): React.CSSProperties => {
    const g = gap / 2, eps = 0.05;
    return {
      position:      'absolute',
      left:          `${cell.x}%`, top: `${cell.y}%`,
      width:         `${cell.w}%`, height: `${cell.h}%`,
      paddingTop:    cell.y < eps                ? 0 : g,
      paddingBottom: cell.y + cell.h > 100 - eps ? 0 : g,
      paddingLeft:   cell.x < eps                ? 0 : g,
      paddingRight:  cell.x + cell.w > 100 - eps ? 0 : g,
    };
  }, [gap]);

  // Zoom slider: klempit offset agar tidak keluar saat scale dikurangi
  const handleScaleChange = useCallback((i: number, newScale: number) => {
    setCells(prev => prev.map((c, ci) => {
      if (ci !== i) return c;
      // Saat scale turun, offset mungkin jadi terlalu besar → clamp
      // Kita tidak tahu cell size dalam px di sini, tapi kita tahu:
      // maxOffset (fraksi) = (scale - 1) / (2 * scale) saat gambar mengisi penuh
      // Pendekatan sederhana: clamp ke ± (newScale-1)/2
      const maxOff = Math.max(0, (newScale - 1) / 2);
      return {
        ...c,
        scale: newScale,
        offsetX: Math.max(-maxOff, Math.min(maxOff, c.offsetX)),
        offsetY: Math.max(-maxOff, Math.min(maxOff, c.offsetY)),
      };
    }));
  }, []);

  // Export canvas — menggunakan objectFit:contain + CSS transform yang sama
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const [expW, expH] = aspectRatio.split(':').map(Number);
      const W = 1080, H = Math.round(W * expH / expW);
      const gPx = gap, eps = 0.05;

      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < selectedLayout.cells.length; i++) {
        const cell = selectedLayout.cells[i];
        const cs   = cells[i];
        if (!cs?.imageSrc) continue;

        const pT = cell.y < eps ? 0 : gPx / 2;
        const pB = cell.y + cell.h > 100 - eps ? 0 : gPx / 2;
        const pL = cell.x < eps ? 0 : gPx / 2;
        const pR = cell.x + cell.w > 100 - eps ? 0 : gPx / 2;

        const cX = (cell.x / 100) * W + pL;
        const cY = (cell.y / 100) * H + pT;
        const cW = (cell.w / 100) * W - pL - pR;
        const cH = (cell.h / 100) * H - pT - pB;

        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = rej;
          im.src = cs.imageSrc!;
          if (im.complete && im.naturalWidth > 0) res(im);
        });

        // Replikasi persis: objectFit:contain → scale(cs.scale) → translate(offsetX%, offsetY%)
        // Step 1: contain scale
        const containScale = Math.min(cW / img.naturalWidth, cH / img.naturalHeight);
        // Step 2: rendered size setelah contain
        const containW = img.naturalWidth  * containScale;
        const containH = img.naturalHeight * containScale;
        // Step 3: terapkan user scale (zoom)
        const finalW = containW * cs.scale;
        const finalH = containH * cs.scale;
        // Step 4: posisi awal (center dari cell) — sama seperti objectPosition:center
        const baseCX = cX + (cW - containW) / 2;
        const baseCY = cY + (cH - containH) / 2;
        // Step 5: terapkan zoom dari center contain
        const zoomOriginX = baseCX + containW / 2;
        const zoomOriginY = baseCY + containH / 2;
        const afterZoomX = zoomOriginX - finalW / 2;
        const afterZoomY = zoomOriginY - finalH / 2;
        // Step 6: terapkan offset (fraksi dari cW/cH, seperti translate di CSS)
        const finalX = afterZoomX + cs.offsetX * cW;
        const finalY = afterZoomY + cs.offsetY * cH;

        ctx.save();
        ctx.beginPath();
        ctx.rect(cX, cY, cW, cH);
        ctx.clip();
        ctx.drawImage(img, finalX, finalY, finalW, finalH);
        ctx.restore();
      }

      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `kolase_${Date.now()}.png`;
        document.body.appendChild(a); a.click();
        requestAnimationFrame(() => { document.body.removeChild(a); URL.revokeObjectURL(url); });
      }, 'image/png');
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const [arW, arH]      = aspectRatio.split(':').map(Number);
  const photoCounts     = [...new Set(COLLAGE_LAYOUTS.map(l => l.photoCount))].sort((a, b) => a - b);
  const filteredLayouts = filterCount ? COLLAGE_LAYOUTS.filter(l => l.photoCount === filterCount) : COLLAGE_LAYOUTS;
  const filledCount     = cells.filter(c => c?.imageSrc).length;
  const selCs           = selectedCell !== null ? cells[selectedCell] : null;

  return (
    <div className="space-y-6" data-collage-area>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ═══ PANEL KIRI ═══ */}
        <div className="space-y-5">

          {/* Aspek Rasio */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Aspek Rasio Output</label>
            <div className="grid grid-cols-3 gap-2">
              {ASPECT_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setAspectRatio(opt.value)}
                  className={`py-2 px-2 rounded-lg text-center transition-all border ${aspectRatio === opt.value ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-700/60 border-slate-600 text-slate-300 hover:border-indigo-500/50'}`}
                >
                  <div className="text-sm font-bold">{opt.label}</div>
                  <div className="text-[10px] opacity-70">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ═══ KONTROL FOTO TERPILIH ═══ */}
          <div
            className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              selCs?.imageSrc ? 'border-indigo-500/60 bg-indigo-950/40' : 'border-slate-700 bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${selCs?.imageSrc ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-sm font-semibold text-slate-300">
                  {selectedCell !== null && selCs?.imageSrc ? `Foto ${selectedCell + 1} Dipilih` : 'Klik foto untuk edit'}
                </span>
              </div>
              {selCs?.imageSrc && (
                <button type="button"
                  onClick={() => updateCell(selectedCell!, { scale: 1, offsetX: 0, offsetY: 0 })}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-700/50 hover:bg-slate-700 transition-colors"
                >↺ Reset</button>
              )}
            </div>

            <div className="px-4 py-3 space-y-4">
              {selCs?.imageSrc ? (
                <>
                  {/* ZOOM SLIDER */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                        </svg>
                        Zoom / Perbesar
                      </label>
                      <span className="text-sm font-bold text-indigo-400 font-mono bg-slate-700 px-2 py-0.5 rounded">
                        {(selCs.scale * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button type="button"
                        onClick={() => handleScaleChange(selectedCell!, Math.max(1, selCs.scale - 0.1))}
                        className="w-8 h-8 flex-shrink-0 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center justify-center text-lg font-bold transition-colors select-none"
                      >−</button>

                      <input
                        type="range"
                        min={100} max={300} step={1}
                        value={Math.round(selCs.scale * 100)}
                        onChange={e => handleScaleChange(selectedCell!, Number(e.target.value) / 100)}
                        className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-indigo-500 bg-slate-700"
                      />

                      <button type="button"
                        onClick={() => handleScaleChange(selectedCell!, Math.min(3, selCs.scale + 0.1))}
                        className="w-8 h-8 flex-shrink-0 bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center justify-center text-lg font-bold transition-colors select-none"
                      >+</button>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 mt-1 px-10">
                      <span>100% (penuh)</span>
                      <span>300% (zoom)</span>
                    </div>
                  </div>

                  {/* Hint geser */}
                  <div className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-3 py-2">
                    <span className="text-base">✋</span>
                    <span className="text-[11px] text-slate-400">
                      Drag foto di preview untuk menggeser area yang tampil
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500 text-center py-3">
                  Upload foto ke slot, lalu klik untuk mengatur zoom &amp; posisi
                </p>
              )}
            </div>
          </div>

          {/* Gap */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Jarak Antar Foto</label>
              <span className="text-sm font-bold text-indigo-400 bg-slate-700 px-2 py-0.5 rounded">{gap}px</span>
            </div>
            <input type="range" min={0} max={24} value={gap} onChange={e => setGap(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-indigo-500 bg-slate-700"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1"><span>Tanpa Jarak</span><span>Lebar</span></div>
          </div>

          {/* Background */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Warna Background</label>
            <div className="flex items-center gap-3 mb-2">
              <label className="w-10 h-10 rounded-lg cursor-pointer border-2 border-slate-600 hover:border-indigo-500 overflow-hidden flex-shrink-0" style={{ background: bgColor }}>
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="opacity-0 w-0 h-0" />
              </label>
              <input type="text" value={bgColor} onChange={e => setBgColor(e.target.value)}
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {BG_PRESETS.map(c => (
                <button key={c} type="button" onClick={() => setBgColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${bgColor === c ? 'border-white scale-110' : 'border-slate-600'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          {/* Layout */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">Pilih Layout Kolase</label>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              <button type="button" onClick={() => setFilterCount(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterCount === null ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
              >Semua</button>
              {photoCounts.map(n => (
                <button key={n} type="button" onClick={() => setFilterCount(n === filterCount ? null : n)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filterCount === n ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                >{n} Foto</button>
              ))}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-52 overflow-y-auto pr-1">
              {filteredLayouts.map(layout => {
                const isActive = selectedLayout.id === layout.id;
                return (
                  <button key={layout.id} type="button" onClick={() => setSelectedLayout(layout)} title={layout.name}
                    className={`group rounded-lg overflow-hidden transition-all ${isActive ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-slate-800 scale-105' : 'ring-1 ring-slate-600 hover:ring-indigo-400'}`}
                  >
                    <div className="aspect-square bg-slate-900 relative">
                      {layout.cells.map((cell, ci) => (
                        <div key={ci}
                          className={`absolute border border-slate-900 ${isActive ? 'bg-indigo-500/70' : 'bg-slate-500/60 group-hover:bg-indigo-400/50'}`}
                          style={{ left:`${cell.x}%`, top:`${cell.y}%`, width:`${cell.w}%`, height:`${cell.h}%` }}
                        />
                      ))}
                    </div>
                    <div className="bg-slate-800 px-1 py-0.5">
                      <p className="text-[8px] text-slate-400 truncate text-center">{layout.name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export */}
          <div className="pt-2">
            <button type="button" onClick={handleExport} disabled={isExporting}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2.5"
            >
              {isExporting
                ? <><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Mengekspor...</>
                : <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Download Kolase (PNG)</>
              }
            </button>
            <p className="text-center text-xs text-slate-500 mt-1.5">Output 1080px × aspek rasio terpilih</p>
          </div>
        </div>

        {/* ═══ PANEL KANAN: Preview ═══ */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Preview Kolase</span>
            <span className="text-xs text-slate-500 italic">{selectedLayout.name} · {aspectRatio}</span>
          </div>

          <div
            className="w-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-slate-700 relative"
            style={{ aspectRatio: `${arW} / ${arH}`, background: bgColor }}
          >
            {selectedLayout.cells.map((cell, i) => (
              <div key={`${selectedLayout.id}-${i}`} style={getCellStyle(cell)}>
                <CellEditor
                  cs={cells[i] ?? DEFAULT_CELL()} idx={i}
                  isDragOver={dragOverCell === i}
                  isSelected={selectedCell === i}
                  onSelect={setSelectedCell}
                  onUpdate={updateCell}
                  onUpload={handleUpload}
                  onRemove={handleRemove}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                />
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex gap-1">
              {selectedLayout.cells.map((_, i) => (
                <div key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    cells[i]?.imageSrc
                      ? (selectedCell === i ? 'bg-indigo-400 w-5' : 'bg-indigo-600 w-4')
                      : 'bg-slate-600 w-2'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-slate-500">{filledCount} / {selectedLayout.cells.length} foto</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CollageEditor;
