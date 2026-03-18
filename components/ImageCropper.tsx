
import React, { useState, useRef, useEffect } from 'react';
import { AspectRatio } from '../types';
import { smartEditImage } from '../services/geminiService';
import Icon from './Icon';

interface ImageCropperProps {
  imageSrc: string;
  imageMimeType: string;
  targetAspectRatio: number;
  aspectRatio: AspectRatio;
  onCropComplete: (croppedImage: { data: string; mimeType: string }) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  imageSrc,
  imageMimeType,
  targetAspectRatio,
  aspectRatio,
  onCropComplete,
  onCancel,
}) => {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  
  // State to hold explicit dimensions for the crop box
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null); // New ref for the available space wrapper
  const imageDimensions = useRef({ width: 0, height: 0 });
  
  useEffect(() => {
    const calculateLayout = () => {
        const wrapper = wrapperRef.current;
        const image = imageRef.current;
        
        if (!wrapper || !image) return;

        // 1. Determine Available Space (Accounting for padding roughly)
        // Using getBoundingClientRect is safer to get the actual visible box.
        const wrapperRect = wrapper.getBoundingClientRect();
        // Assuming 1rem padding on each side (16px * 2 = 32px)
        const availableWidth = wrapperRect.width - 32; 
        const availableHeight = wrapperRect.height - 32;

        if (availableWidth <= 0 || availableHeight <= 0) return;

        // 2. Calculate Box Size that fits within available space while maintaining Target Ratio
        let boxWidth = availableWidth;
        let boxHeight = boxWidth / targetAspectRatio;

        // If calculated height exceeds available height, scale down based on height
        if (boxHeight > availableHeight) {
            boxHeight = availableHeight;
            boxWidth = boxHeight * targetAspectRatio;
        }

        setLayout({ width: boxWidth, height: boxHeight });

        // 3. Calculate Image Size (Cover) relative to the new Box Size
        const naturalW = image.naturalWidth;
        const naturalH = image.naturalHeight;
        const imgRatio = naturalW / naturalH;

        let renderImgW, renderImgH;
        
        // Cover logic:
        if (imgRatio > targetAspectRatio) {
            // Image is "wider" than the box -> Match Box Height, let width overflow
            renderImgH = boxHeight;
            renderImgW = renderImgH * imgRatio;
        } else {
            // Image is "taller" than the box -> Match Box Width, let height overflow
            renderImgW = boxWidth;
            renderImgH = renderImgW / imgRatio;
        }

        imageDimensions.current = { width: renderImgW, height: renderImgH };
        
        // Reset zoom and offset only on initial calculation (when zoom is 1)
        // or we could check if it's a fresh load. 
        // For now, we reset to ensure it's centered.
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    };

    const image = imageRef.current;
    if (image) {
        if (image.complete) {
            // Slight delay to ensure wrapper is rendered and has dimensions
            setTimeout(calculateLayout, 50);
        }
        image.onload = calculateLayout;
    }

    window.addEventListener('resize', calculateLayout);
    return () => window.removeEventListener('resize', calculateLayout);

  }, [targetAspectRatio, imageSrc]);
  
  const handleDragStart = (x: number, y: number) => {
    setIsDragging(true);
    setLastPosition({ x, y });
  };
  
  const handleDragMove = (x: number, y: number) => {
      if (!isDragging) return;
      const dx = x - lastPosition.x;
      const dy = y - lastPosition.y;
      setLastPosition({ x, y });
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };
  
  const handleDragEnd = () => setIsDragging(false);

  const handleMouseDown = (e: React.MouseEvent) => handleDragStart(e.clientX, e.clientY);
  const handleMouseMove = (e: React.MouseEvent) => handleDragMove(e.clientX, e.clientY);
  const handleTouchStart = (e: React.TouchEvent) => e.touches.length === 1 && handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => e.touches.length === 1 && handleDragMove(e.touches[0].clientX, e.touches[0].clientY);

  const handleCrop = async () => {
    const image = imageRef.current;
    const container = containerRef.current;
    if (!image || !container) return;

    // 1. Set up Canvas
    const canvas = document.createElement('canvas');
    // Use a reasonable resolution for the output (max 1080px width)
    const outputWidth = Math.min(image.naturalWidth, 1080);
    const outputHeight = outputWidth / targetAspectRatio;
    
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 2. Fill with Black (Background)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Calculate Drawing Coordinates
    // Important: Use the actual rendered container dimensions
    const containerRect = container.getBoundingClientRect();
    const scaleToOutput = canvas.width / containerRect.width;

    const { width: displayedImgW, height: displayedImgH } = imageDimensions.current;
    
    const zoomedW = displayedImgW * zoom;
    const zoomedH = displayedImgH * zoom;

    // Calculate centered position relative to canvas center, then apply offsets
    const drawX = (canvas.width / 2) + (offset.x * scaleToOutput) - ((zoomedW * scaleToOutput) / 2);
    const drawY = (canvas.height / 2) + (offset.y * scaleToOutput) - ((zoomedH * scaleToOutput) / 2);
    const drawW = zoomedW * scaleToOutput;
    const drawH = zoomedH * scaleToOutput;

    // 4. Draw the image
    ctx.drawImage(image, drawX, drawY, drawW, drawH);

    // 5. Detect if we need Expansion/Editing
    const epsilon = 0.5; 
    const hasGap = 
        drawX > epsilon || 
        drawY > epsilon || 
        (drawX + drawW) < (canvas.width - epsilon) || 
        (drawY + drawH) < (canvas.height - epsilon);

    const base64 = canvas.toDataURL(imageMimeType).split(',')[1];
    
    const hasInstructions = editInstruction.trim().length > 0;

    if (hasGap || hasInstructions) {
        setIsProcessing(true);
        try {
            const processedImageBase64 = await smartEditImage(base64, imageMimeType, aspectRatio, editInstruction);
            onCropComplete({ data: processedImageBase64, mimeType: imageMimeType });
        } catch (error) {
            console.error("AI Edit failed:", error);
            alert("Gagal melakukan editing AI. Menyimpan hasil crop apa adanya.");
            onCropComplete({ data: base64, mimeType: imageMimeType });
        } finally {
            setIsProcessing(false);
        }
    } else {
        onCropComplete({ data: base64, mimeType: imageMimeType });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in">
        {/* Main Modal Container: Flex Column, Max Height constrained to viewport */}
        <div 
            className="bg-slate-800 rounded-xl w-full max-w-lg flex flex-col shadow-2xl border border-slate-700 relative" 
            style={{ maxHeight: '90vh' }}
        >
            
            {isProcessing && (
                <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg">
                     <svg className="animate-spin h-10 w-10 text-indigo-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                     </svg>
                     <p className="text-indigo-300 font-semibold animate-pulse">{editInstruction ? "Sedang mengedit gambar..." : "Sedang mengisi area kosong..."}</p>
                     <p className="text-slate-400 text-xs mt-1">Mohon tunggu sebentar</p>
                </div>
            )}

            {/* Header: Fixed (shrink-0) */}
            <div className="p-4 border-b border-slate-700 bg-slate-800 shrink-0 z-10 rounded-t-xl">
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-lg font-bold text-white">Editor Gambar AI</h3>
                    <span className="px-2 py-1 rounded bg-slate-700 text-xs text-slate-300 font-mono">{aspectRatio === '1:1' ? 'Persegi' : aspectRatio}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                    Geser/zoom posisi. Area hitam akan otomatis <strong>diisi AI</strong>.
                </p>
            </div>
            
            {/* Body: Scrollable, with explicit height for layout calculation context */}
            <div className="overflow-y-auto bg-black/20 flex flex-col">
                <div 
                    ref={wrapperRef}
                    className="w-full flex items-center justify-center p-4"
                    style={{ height: '55vh' }} // Fixed reference height for calculation
                >
                    <div
                        ref={containerRef}
                        className="relative bg-[#000000] overflow-hidden cursor-move touch-none rounded-md border border-slate-600 shadow-inner"
                        style={{ 
                            // Set width and height explicitly based on calculation
                            width: layout.width > 0 ? `${layout.width}px` : 'auto',
                            height: layout.height > 0 ? `${layout.height}px` : 'auto',
                            // Fallback if layout not yet calculated
                            opacity: layout.width > 0 ? 1 : 0 
                        }}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleDragEnd}
                    >
                        {/* Grid Lines for Rule of Thirds */}
                        <div className="absolute inset-0 pointer-events-none z-10 opacity-20">
                            <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                                <div className="border-r border-b border-white/50"></div>
                                <div className="border-r border-b border-white/50"></div>
                                <div className="border-b border-white/50"></div>
                                <div className="border-r border-b border-white/50"></div>
                                <div className="border-r border-b border-white/50"></div>
                                <div className="border-b border-white/50"></div>
                                <div className="border-r border-white/50"></div>
                                <div className="border-r border-white/50"></div>
                            </div>
                        </div>

                        <img
                            ref={imageRef}
                            src={imageSrc}
                            className="absolute select-none"
                            style={{
                                width: imageDimensions.current.width,
                                height: imageDimensions.current.height,
                                top: '50%',
                                left: '50%',
                                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
                                willChange: 'transform',
                                maxWidth: 'none',
                                maxHeight: 'none',
                            }}
                            alt="Reference preview"
                            draggable={false}
                            crossOrigin="anonymous"
                        />
                    </div>
                </div>
            </div>

            {/* Footer: Fixed (shrink-0) */}
            <div className="p-4 border-t border-slate-700 bg-slate-800 shrink-0 z-10 space-y-3 rounded-b-xl">
                <div className="flex items-center gap-3">
                    <Icon type="download" className="w-4 h-4 text-slate-500" /> 
                    <input
                        type="range"
                        id="zoom"
                        min="0.2" 
                        max="3"
                        step="0.01"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer range-thumb focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <Icon type="sparkles" className="w-4 h-4 text-slate-500" />
                </div>

                {/* AI Text Instruction Input */}
                <div>
                    <label htmlFor="editInstruction" className="block text-xs font-medium text-slate-400 mb-1">
                        Instruksi AI (Opsional)
                    </label>
                    <textarea
                        id="editInstruction"
                        value={editInstruction}
                        onChange={(e) => setEditInstruction(e.target.value)}
                        placeholder="Contoh: Tambahkan teks 'SALE' di belakang, ganti background..."
                        rows={1}
                        className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button 
                        onClick={onCancel} 
                        disabled={isProcessing}
                        className="px-4 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition disabled:opacity-50"
                    >
                        Batal
                    </button>
                    <button 
                        onClick={handleCrop} 
                        disabled={isProcessing}
                        className="px-6 py-2 rounded-md text-sm font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 transition shadow-lg transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isProcessing ? 'Memproses...' : (
                            <>
                                <Icon type="check" className="w-4 h-4" />
                                Terapkan
                            </>
                        )}
                    </button>
                </div>
            </div>
            
            <style>{`
                .range-thumb::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    background: #818cf8;
                    cursor: pointer;
                    border-radius: 50%;
                    border: 2px solid #312e81;
                    transition: background 0.15s ease;
                }
                .range-thumb::-webkit-slider-thumb:hover {
                    background: #a5b4fc;
                }
                .range-thumb::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    background: #818cf8;
                    cursor: pointer;
                    border-radius: 50%;
                    border: 2px solid #312e81;
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
            `}</style>
        </div>
    </div>
  );
};

export default ImageCropper;
