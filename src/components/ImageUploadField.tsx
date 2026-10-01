import React, { useState, useRef, DragEvent, ChangeEvent } from "react";
import {
  UploadCloud,
  Link as LinkIcon,
  Image as ImageIcon,
  X,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";
import { supabase } from "../utils/supabase";

export interface ImageUploadFieldProps {
  label?: string;
  sublabel?: string;
  value: string;
  onChange: (value: string) => void;
  aspectRatio?: "video" | "square" | "landscape" | "auto" | "wide";
  presets?: { label: string; url: string }[];
  placeholder?: string;
  className?: string;
  maxDimension?: number;
}

/**
 * Optimizes and converts an image File to a lightweight data URL using HTML Canvas.
 * This prevents massive 10MB raw photos from overwhelming browser storage/database,
 * scaling it down to a crisp web-optimized resolution.
 */
async function processImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    // For vector SVG or animated GIF, keep original encoding
    if (file.type === "image/svg+xml" || file.type === "image/gif") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const dataUrl = canvas.toDataURL(mimeType, quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Attempts to upload the file to Supabase storage if any common bucket exists ('cms', 'public', 'images').
 * Returns the public URL if successful, or null to fall back to the optimized Data URL.
 */
async function tryUploadToSupabase(file: File): Promise<string | null> {
  try {
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `cms/${fileName}`;

    for (const bucket of ["cms", "public", "images"]) {
      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (!error && data) {
        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        if (pubData?.publicUrl) {
          return pubData.publicUrl;
        }
      }
    }
  } catch (err) {
    // Fall back to data URL
  }
  return null;
}

export function ImageUploadField({
  label,
  sublabel,
  value,
  onChange,
  aspectRatio = "video",
  presets = [],
  placeholder = "https://images.unsplash.com/...",
  className,
  maxDimension = 1600,
}: ImageUploadFieldProps) {
  // Mode: 'upload' | 'url' | 'presets'
  const isDataUrl = value && value.startsWith("data:");
  const [activeTab, setActiveTab] = useState<"upload" | "url" | "presets">(
    isDataUrl ? "upload" : "upload"
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadFileSize, setUploadFileSize] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image file (PNG, JPG, JPEG, WebP, GIF).");
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);

    try {
      setUploadFileName(file.name);
      const sizeKb = (file.size / 1024).toFixed(1);
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        : `${sizeKb} KB`;
      setUploadFileSize(sizeStr);

      // 1. Generate optimized client data URL immediately for responsive UI
      const optimizedDataUrl = await processImageFile(file, maxDimension);

      // 2. Try remote Supabase upload in the background
      const remoteUrl = await tryUploadToSupabase(file);

      // 3. Update value (prefer remote URL if available, else optimized Data URL)
      onChange(remoteUrl || optimizedDataUrl);
    } catch (err: any) {
      console.error("Image processing error:", err);
      setErrorMsg("Failed to process image file. Please try another file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    onChange("");
    setUploadFileName(null);
    setUploadFileSize(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header / Labels */}
      {(label || sublabel) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          {label && (
            <label className="text-[10px] font-bold text-natural-text-light uppercase tracking-widest block">
              {label}
            </label>
          )}
          {sublabel && (
            <span className="text-[10px] text-natural-text-light italic">
              {sublabel}
            </span>
          )}
        </div>
      )}

      {/* Input Mode Selector Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-natural-bg/60 border border-natural-border rounded-lg text-xs w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer",
            activeTab === "upload"
              ? "bg-natural-card text-natural-text-main shadow-xs border border-natural-border font-bold"
              : "text-natural-text-light hover:text-natural-text-main"
          )}
        >
          <UploadCloud className="w-3.5 h-3.5 text-natural-accent" />
          <span>Upload File</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("url")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer",
            activeTab === "url"
              ? "bg-natural-card text-natural-text-main shadow-xs border border-natural-border font-bold"
              : "text-natural-text-light hover:text-natural-text-main"
          )}
        >
          <LinkIcon className="w-3.5 h-3.5 text-natural-accent" />
          <span>Image URL Link</span>
        </button>

        {presets.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("presets")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer",
              activeTab === "presets"
                ? "bg-natural-card text-natural-text-main shadow-xs border border-natural-border font-bold"
                : "text-natural-text-light hover:text-natural-text-main"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Curated Presets</span>
          </button>
        )}
      </div>

      {/* Mode 1: File Upload Dropzone */}
      {activeTab === "upload" && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileInputChange}
            className="hidden"
          />

          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2",
              isDragging
                ? "border-natural-accent bg-natural-accent/10 scale-[1.01]"
                : "border-natural-border hover:border-natural-accent/60 bg-natural-bg/30 hover:bg-natural-bg/50"
            )}
          >
            {isProcessing ? (
              <div className="py-3 flex flex-col items-center gap-2">
                <Loader2 className="w-7 h-7 text-natural-accent animate-spin" />
                <span className="text-xs font-semibold text-natural-text-main">
                  Optimizing and preparing image...
                </span>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-natural-accent/15 border border-natural-accent/30 flex items-center justify-center text-natural-accent shadow-xs">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-natural-text-main">
                    Drag and drop an image here, or{" "}
                    <span className="text-natural-accent underline font-bold">
                      Browse Files
                    </span>
                  </p>
                  <p className="text-[10px] text-natural-text-light mt-0.5">
                    Supports PNG, JPG, JPEG, WebP, GIF (Auto-compressed for web performance)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Direct Image URL Link Input */}
      {activeTab === "url" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3.5 py-2.5 bg-natural-bg/40 border border-natural-border rounded-lg text-xs text-natural-text-main focus:outline-none focus:ring-2 focus:ring-natural-accent/20"
            />
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="p-2.5 text-natural-text-light hover:text-red-500 hover:bg-natural-bg rounded-lg border border-natural-border transition-colors cursor-pointer"
                title="Clear image URL"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-natural-text-light">
            Paste a public web image address from Unsplash, Pexels, or your hosted CDN.
          </p>
        </div>
      )}

      {/* Mode 3: Curated Presets */}
      {activeTab === "presets" && presets.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(preset.url)}
                className={cn(
                  "relative aspect-video rounded-lg overflow-hidden border-2 text-left group transition-all cursor-pointer",
                  value === preset.url
                    ? "border-natural-accent ring-2 ring-natural-accent/30"
                    : "border-natural-border hover:border-natural-accent/50 opacity-70 hover:opacity-100"
                )}
              >
                <img
                  src={preset.url}
                  alt={preset.label}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 p-1.5 flex items-end">
                  <span className="text-[9px] font-bold text-white leading-tight">
                    {preset.label}
                  </span>
                </div>
                {value === preset.url && (
                  <div className="absolute top-1 right-1 p-0.5 bg-natural-accent rounded-full text-white shadow-xs">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <p className="text-xs text-red-500 font-medium animate-in fade-in">
          {errorMsg}
        </p>
      )}

      {/* Live Preview Card (if an image is selected) */}
      {value && (
        <div className="glass-card p-3 rounded-xl border border-natural-border space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs pb-1 border-b border-natural-border/60">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-natural-text-main flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-natural-accent" />
                Active Image Preview
              </span>
              <span
                className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                  isDataUrl
                    ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200"
                    : "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200"
                )}
              >
                {isDataUrl ? "Uploaded File" : "Remote Web Link"}
              </span>
              {uploadFileSize && (
                <span className="text-[10px] text-natural-text-light font-mono">
                  {uploadFileSize}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (activeTab !== "upload") setActiveTab("upload");
                  fileInputRef.current?.click();
                }}
                className="px-2 py-1 text-[10px] font-semibold text-natural-text-main hover:bg-natural-bg rounded border border-natural-border transition-colors cursor-pointer flex items-center gap-1"
                title="Replace with another file"
              >
                <RefreshCw className="w-3 h-3 text-natural-accent" />
                Replace
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded border border-red-200 dark:border-red-900 transition-colors cursor-pointer flex items-center gap-1"
                title="Remove image"
              >
                <X className="w-3 h-3" />
                Remove
              </button>
            </div>
          </div>

          <div
            className={cn(
              "relative rounded-lg overflow-hidden border border-natural-border shadow-inner bg-stone-900/5",
              aspectRatio === "video" && "aspect-video max-h-48",
              aspectRatio === "wide" && "aspect-[21/9] max-h-44",
              aspectRatio === "landscape" && "aspect-[4/3] max-h-52",
              aspectRatio === "square" && "aspect-square max-h-48",
              aspectRatio === "auto" && "max-h-56"
            )}
          >
            <img
              src={value}
              alt="Selected Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Image failed to load (e.g. broken external link or blocked by referrer policy)
                const target = e.currentTarget;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent && !parent.querySelector(".img-error-badge")) {
                  const div = document.createElement("div");
                  div.className = "img-error-badge absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-red-950/20 text-red-400 text-xs";
                  div.innerHTML = `<span class="font-bold">⚠️ Unable to load image link</span><span class="text-[10px] mt-1 text-natural-text-light">The remote server might block hotlinking. Try uploading the image file directly from your computer instead.</span>`;
                  parent.appendChild(div);
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
