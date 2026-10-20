import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  FileText, 
  X, 
  Sparkles, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  FlipHorizontal, 
  Maximize2, 
  Copy, 
  Check, 
  Eye, 
  FileCode,
  Image as ImageIcon
} from 'lucide-react';
import type { HadithMediaExtractionResult } from '../server/hadithOcrService';

interface HadithMediaUploadModalProps {
  isOpen: boolean;
  initialMode?: 'camera' | 'upload_photo' | 'upload_file';
  onClose: () => void;
  onApplyExtracted: (matn: string, isnad: string, autoRun?: boolean) => void;
}

export function HadithMediaUploadModal({
  isOpen,
  initialMode = 'upload_photo',
  onClose,
  onApplyExtracted,
}: HadithMediaUploadModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload_photo' | 'upload_file'>(initialMode);
  
  // Media states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState<string>('');
  
  // Camera stream states
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  
  // Processing & Extraction states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [extractionResult, setExtractionResult] = useState<HadithMediaExtractionResult | null>(null);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Hidden file inputs
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialMode);
    } else {
      stopCamera();
      resetState();
    }
  }, [isOpen, initialMode]);

  // Handle camera start/stop when switching tabs
  useEffect(() => {
    if (isOpen && activeTab === 'camera' && !capturedImageBase64) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, cameraFacing, capturedImageBase64]);

  const resetState = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCapturedImageBase64(null);
    setUserNotes('');
    setExtractionResult(null);
    setProcessError(null);
    setCameraError(null);
  };

  const startCamera = async () => {
    setCameraError(null);
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      setIsCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.log('Video play error:', e));
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      // Fallback try without facingMode
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setCameraStream(stream);
        setIsCameraActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch((e) => console.log('Video play fallback error:', e));
        }
      } catch (fallbackErr: any) {
        setCameraError(
          fallbackErr.name === 'NotAllowedError'
            ? 'Camera access was blocked. Please grant camera permission in your browser or upload an image file instead.'
            : 'Unable to start camera on this device. You can choose "Upload Photo" or "Upload File".'
        );
        setIsCameraActive(false);
      }
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImageBase64(dataUrl);
    setPreviewUrl(dataUrl);
    stopCamera();
  };

  const handleRetakeSnapshot = () => {
    setCapturedImageBase64(null);
    setPreviewUrl(null);
    setExtractionResult(null);
    startCamera();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isDoc: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setExtractionResult(null);
    setProcessError(null);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPreviewUrl(result);
        setCapturedImageBase64(result);
      };
      reader.readAsDataURL(file);
    } else {
      // Document file (PDF, TXT)
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setPreviewUrl(result);
        setCapturedImageBase64(result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and drop handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setExtractionResult(null);
    setProcessError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewUrl(result);
      setCapturedImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  // Execute Multimodal Extraction via /api/extract-hadith-media
  const handleExecuteOcr = async () => {
    if (!capturedImageBase64) {
      setProcessError('Please take a photo or select an image/document file first.');
      return;
    }

    setIsProcessing(true);
    setProcessError(null);

    try {
      const mimeType = selectedFile?.type || 'image/jpeg';
      const response = await fetch('/api/extract-hadith-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_base64: capturedImageBase64,
          mime_type: mimeType,
          user_notes: userNotes,
        }),
      });

      if (!response.ok) {
        throw new Error(`Extraction service returned HTTP ${response.status}`);
      }

      const data: HadithMediaExtractionResult = await response.json();
      setExtractionResult(data);
    } catch (err: any) {
      console.error('OCR Extraction error:', err);
      setProcessError(err.message || 'Failed to extract Hadith text from uploaded file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyArabic = () => {
    if (!extractionResult?.hadith_matn_arabic) return;
    navigator.clipboard.writeText(extractionResult.hadith_matn_arabic);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleApplyToForm = (autoRun: boolean) => {
    if (!extractionResult) return;
    const matn = extractionResult.hadith_matn_arabic 
      ? `${extractionResult.hadith_matn_arabic}\n\n"${extractionResult.hadith_matn_english}"`
      : extractionResult.hadith_matn_english;
    const isnad = extractionResult.detected_isnad || '';

    onApplyExtracted(matn, isnad, autoRun);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[var(--surface-modal)] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto animate-fadeIn">
        
        {/* Glow accent */}
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative z-10 flex items-center justify-between p-5 sm:p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <span>Optical Hadith & Manuscript Scanner</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                  Multimodal AI
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Snap or upload photos of printed Hadiths, manuscripts, book pages, or PDFs for instant OCR and 6-agent audit.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs: Camera vs Photo Upload vs Document Upload */}
        <div className="relative z-10 flex border-b border-slate-800 bg-[var(--surface-raised)] px-4 pt-2">
          <button
            onClick={() => {
              setActiveTab('camera');
              setCapturedImageBase64(null);
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'camera'
                ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Take Photo (Live Camera)</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('upload_photo');
              stopCamera();
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload_photo'
                ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Upload Photo / Scan</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('upload_file');
              stopCamera();
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload_file'
                ? 'border-amber-400 text-amber-400 bg-amber-400/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Upload Document (PDF / File)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="relative z-10 p-5 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          
          {/* TAB 1: LIVE CAMERA VIEWFINDER */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              {!capturedImageBase64 ? (
                <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-700/80 aspect-video flex items-center justify-center shadow-inner group">
                  {cameraError ? (
                    <div className="p-6 text-center max-w-md space-y-3">
                      <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                      <p className="text-xs sm:text-sm text-slate-300">{cameraError}</p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[var(--on-gold)] text-xs font-bold transition-all cursor-pointer"
                      >
                        Try Camera Again
                      </button>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* Manuscript Targeting HUD Overlay */}
                      <div className="absolute inset-8 border border-dashed border-amber-400/40 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                        <div className="flex justify-between text-[10px] font-mono text-amber-400/70">
                          <span>⌜ DRAGON-DAWWA OPTICAL HUD</span>
                          <span>FRAME HADITH TEXT ⌝</span>
                        </div>
                        <div className="flex justify-between text-[10px] font-mono text-amber-400/70">
                          <span>⌞ ALIGN ARABIC MATN / ISNAD</span>
                          <span>AUTO-RESOLUTION ⌟</span>
                        </div>
                      </div>

                      {/* Live controls overlay */}
                      <div className="absolute bottom-4 inset-x-4 flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={toggleCameraFacing}
                          className="p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-all cursor-pointer shadow-lg"
                          title="Switch Camera (Front / Back)"
                        >
                          <FlipHorizontal className="w-5 h-5" />
                        </button>

                        <button
                          type="button"
                          onClick={handleCaptureSnapshot}
                          className="px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-[var(--on-gold)] font-bold text-sm flex items-center gap-2 shadow-xl shadow-amber-500/30 transform active:scale-95 transition-all cursor-pointer"
                        >
                          <Camera className="w-5 h-5 fill-slate-950" />
                          <span>Capture Frame</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Snapshot Captured Preview */
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-500/50 aspect-video bg-black flex items-center justify-center">
                    <img
                      src={capturedImageBase64}
                      alt="Captured Hadith Frame"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 text-xs font-mono">
                        Frame Captured
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={handleRetakeSnapshot}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retake Photo</span>
                    </button>

                    <span className="text-xs text-slate-400">
                      Ready for Optical Hadith Extraction
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2 & 3: PHOTO UPLOAD OR DOCUMENT UPLOAD */}
          {(activeTab === 'upload_photo' || activeTab === 'upload_file') && (
            <div className="space-y-4">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, false)}
                className="hidden"
              />
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.txt,.doc,.docx,image/*"
                onChange={(e) => handleFileChange(e, true)}
                className="hidden"
              />

              {!capturedImageBase64 ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => {
                    if (activeTab === 'upload_photo') {
                      photoInputRef.current?.click();
                    } else {
                      docInputRef.current?.click();
                    }
                  }}
                  className="border-2 border-dashed border-slate-700 hover:border-amber-500/80 bg-[var(--surface-raised)]/60 hover:bg-[var(--surface-hover)]/80 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 transition-all">
                    {activeTab === 'upload_photo' ? (
                      <Upload className="w-6 h-6" />
                    ) : (
                      <FileText className="w-6 h-6" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">
                      {activeTab === 'upload_photo'
                        ? 'Click to browse or drag & drop a Hadith photo / image'
                        : 'Click to browse or drag & drop Hadith document (PDF, TXT, Scans)'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports high-resolution manuscripts, book pages, screenshots, and scans (JPG, PNG, WEBP, PDF)
                    </p>
                  </div>

                  <span className="inline-block px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700">
                    Max payload 50MB
                  </span>
                </div>
              ) : (
                /* Selected File Preview */
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-black/60 p-4 flex items-center gap-4">
                    {previewUrl?.startsWith('data:image/') ? (
                      <img
                        src={previewUrl}
                        alt="Uploaded Hadith"
                        className="w-24 h-24 object-cover rounded-xl border border-slate-700"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <FileText className="w-10 h-10" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate">
                        {selectedFile?.name || 'Uploaded File / Photo'}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Ready for analysis'}
                      </p>
                      <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-600/30 text-[11px] font-mono">
                        Ready for OCR
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setCapturedImageBase64(null);
                        setExtractionResult(null);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Optional context notes for extraction */}
          {capturedImageBase64 && !extractionResult && (
            <div className="space-y-1.5 pt-2">
              <label htmlFor="user-notes" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Scholarly Focus / Manuscript Notes (Optional)
              </label>
              <input
                id="user-notes"
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="e.g. Focus on the footnote on page 42, or extract the Arabic matn in the center column..."
                className="w-full bg-[var(--surface-inset)] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
              />
            </div>
          )}

          {/* Trigger Scan Button (when file or photo is present and not yet extracted) */}
          {capturedImageBase64 && !extractionResult && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleExecuteOcr}
                disabled={isProcessing}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-[var(--on-gold)] font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[var(--on-gold)]" />
                    <span>Analyzing Image & Transcribing Arabic Manuscript...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-slate-950" />
                    <span>Extract Hadith Matn & Sanad via Optical AI</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error Message if OCR fails */}
          {processError && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{processError}</span>
            </div>
          )}

          {/* EXTRACTED RESULTS VIEW */}
          {extractionResult && (
            <div className="space-y-4 pt-2 border-t border-slate-800 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Optical Hadith Extraction Successful
                  </span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-bold ${
                  extractionResult.confidence_rating === 'high' 
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/30'
                    : 'bg-amber-950 text-amber-400 border border-amber-600/30'
                }`}>
                  {extractionResult.confidence_rating} Confidence OCR
                </span>
              </div>

              {/* Arabic Matn Box */}
              <div className="p-4 rounded-2xl bg-[var(--surface-well)] border border-amber-500/30 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-amber-400">
                  <span>EXTRACTED ARABIC MATN (النَّصُّ النَّبَوِيّ):</span>
                  <button
                    type="button"
                    onClick={handleCopyArabic}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy Arabic'}</span>
                  </button>
                </div>
                <p className="font-arabic text-base sm:text-lg text-amber-100 text-right dir-rtl leading-relaxed font-semibold">
                  {extractionResult.hadith_matn_arabic}
                </p>
              </div>

              {/* English Translation */}
              <div className="p-4 rounded-2xl bg-[var(--surface-well)] border border-slate-800 space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  English Translation:
                </span>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
                  "{extractionResult.hadith_matn_english}"
                </p>
              </div>

              {/* Detected Isnad & Source */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400">Detected Sanad / Chain:</span>
                  <p className="font-mono text-xs text-slate-200">
                    {extractionResult.detected_isnad || 'Auto-infer from primary Kutub al-Sittah collections.'}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400">Identified Source / Reference:</span>
                  <p className="text-xs text-emerald-400 font-medium">
                    {extractionResult.primary_source}
                  </p>
                  <p className="text-[11px] text-slate-400">{extractionResult.manuscript_notes}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => handleApplyToForm(false)}
                  className="w-full sm:w-1/2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Populate Form & Review</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyToForm(true)}
                  className="w-full sm:w-1/2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-[var(--on-gold)] font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 fill-slate-950" />
                  <span>Execute Dragon Dawwa Engine Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
