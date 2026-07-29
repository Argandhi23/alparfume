"use client";

import { useState, useRef, useEffect } from "react";
import { X, ZoomIn, ZoomOut, Check } from "lucide-react";

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string;
  aspectRatio: number; // e.g. 16/9 or 3/4
  title?: string;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob, croppedDataUrl: string) => void;
}

export default function ImageCropperModal({
  isOpen,
  imageSrc,
  aspectRatio,
  title = "Crop Gambar",
  onClose,
  onCropComplete,
}: ImageCropperModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [imageSrc, isOpen]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;

    // Calculate crop dimensions
    const canvas = document.createElement("canvas");
    
    // Standard high-res target output based on aspect ratio
    let targetWidth = 1280;
    let targetHeight = Math.round(1280 / aspectRatio);
    
    if (aspectRatio < 1) {
      targetHeight = 1200;
      targetWidth = Math.round(1200 * aspectRatio);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill background with white/transparent
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Map container transform to image natural dimensions
    const imgBounds = img.getBoundingClientRect();
    const cropBounds = container.getBoundingClientRect();

    const scaleX = img.naturalWidth / imgBounds.width;
    const scaleY = img.naturalHeight / imgBounds.height;

    // Calculate source rectangle on natural image
    let sourceX = (cropBounds.left - imgBounds.left) * scaleX;
    let sourceY = (cropBounds.top - imgBounds.top) * scaleY;
    let sourceWidth = cropBounds.width * scaleX;
    let sourceHeight = cropBounds.height * scaleY;

    // Canvas destination mapping
    const canvasScaleX = targetWidth / cropBounds.width;
    const canvasScaleY = targetHeight / cropBounds.height;

    let destX = 0;
    let destY = 0;
    let destW = targetWidth;
    let destH = targetHeight;

    if (sourceX < 0) {
      destX = (Math.abs(sourceX) / scaleX) * canvasScaleX;
      destW -= destX;
      sourceWidth += sourceX;
      sourceX = 0;
    }
    if (sourceY < 0) {
      destY = (Math.abs(sourceY) / scaleY) * canvasScaleY;
      destH -= destY;
      sourceHeight += sourceY;
      sourceY = 0;
    }

    if (sourceX + sourceWidth > img.naturalWidth) {
      const overflow = sourceX + sourceWidth - img.naturalWidth;
      sourceWidth -= overflow;
      destW -= (overflow / scaleX) * canvasScaleX;
    }
    if (sourceY + sourceHeight > img.naturalHeight) {
      const overflow = sourceY + sourceHeight - img.naturalHeight;
      sourceHeight -= overflow;
      destH -= (overflow / scaleY) * canvasScaleY;
    }

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      Math.max(1, sourceWidth),
      Math.max(1, sourceHeight),
      destX,
      destY,
      Math.max(1, destW),
      Math.max(1, destH)
    );

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const croppedUrl = URL.createObjectURL(blob);
          onCropComplete(blob, croppedUrl);
          onClose();
        }
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 text-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-neutral-100 font-sans">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative w-full flex items-center justify-center bg-neutral-950 rounded-xl overflow-hidden min-h-[300px] max-h-[420px] p-4 select-none">
          {/* Crop Frame / Overlay */}
          <div
            ref={containerRef}
            className="relative border-2 border-dashed border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] overflow-hidden cursor-move"
            style={{
              aspectRatio: `${aspectRatio}`,
              width: aspectRatio >= 1 ? "100%" : "auto",
              height: aspectRatio < 1 ? "320px" : "auto",
              maxHeight: "340px",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Draggable & Scalable Image */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop target"
              className="absolute max-w-none transition-transform duration-75"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
                top: "50%",
                left: "50%",
                marginTop: "-50%",
                marginLeft: "-50%",
              }}
              draggable={false}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4 bg-neutral-950/60 p-3 rounded-xl">
          <div className="flex items-center gap-3 w-full max-w-xs">
            <ZoomOut className="w-4 h-4 text-neutral-400" />
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full accent-white bg-neutral-800 rounded-lg h-1.5 cursor-pointer"
            />
            <ZoomIn className="w-4 h-4 text-neutral-400" />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
            >
              Batal
            </button>
            <button
              onClick={handleCrop}
              className="px-5 py-2 text-sm font-semibold text-black bg-white rounded-lg hover:bg-neutral-200 transition flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Potong & Gunakan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
