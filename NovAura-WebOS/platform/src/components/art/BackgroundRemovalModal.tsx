import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Wand2, 
  RefreshCw, 
  Check, 
  Download,
  Image as ImageIcon,
  Settings,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { BackgroundRemoverService } from '@/services/artStudioServices';
import type { BackgroundRemovalResult } from '@/services/artStudioServices';
interface BackgroundRemovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onProcessed: (result: BackgroundRemovalResult) => void;
}

export function BackgroundRemovalModal({ 
  isOpen, 
  onClose, 
  imageUrl,
  onProcessed 
}: BackgroundRemovalModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<BackgroundRemovalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  
  // Options
  const [tolerance, setTolerance] = useState(30);
  const [edgeDetection, setEdgeDetection] = useState(true);
  const [featherEdges, setFeatherEdges] = useState(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleRemoveBackground = useCallback(async () => {
    if (!imageUrl) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const removalResult = await BackgroundRemoverService.removeBackground(imageUrl, {
        tolerance,
        edgeDetection,
        featherEdges,
      });
      
      if (removalResult.success) {
        setResult(removalResult);
        onProcessed(removalResult);
      } else {
        setError('Failed to remove background. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during processing.');
    } finally {
      setIsProcessing(false);
    }
  }, [imageUrl, tolerance, edgeDetection, featherEdges, onProcessed]);

  const handleDownload = useCallback(() => {
    if (!result?.processedImage) return;
    
    const link = document.createElement('a');
    link.href = result.processedImage;
    link.download = `bg-removed-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [result]);

  const handleUseResult = useCallback(() => {
    if (result) {
      onProcessed(result);
      onClose();
    }
  }, [result, onProcessed, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-4xl bg-void-light border border-white/10 rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center">
                <Wand2 className="w-5 h-5 text-neon-cyan" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">Background Remover</h2>
                <p className="text-xs text-text-muted">Powered by Aura Nova AI</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-text-muted hover:text-text-primary">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* Preview Area */}
            <div className="flex-1 p-6 bg-void">
              <div className="relative aspect-video bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMjIyIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMyMjIiLz48cmVjdCB4PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMzMzIi8+PHJlY3QgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzMzMyIvPjwvc3ZnPg==')] rounded-xl border border-white/10 overflow-hidden">
                {imageUrl && !result && (
                  <img 
                    src={imageUrl} 
                    alt="Original" 
                    className="w-full h-full object-contain"
                  />
                )}
                {result && (
                  <img 
                    src={showOriginal ? result.originalImage : result.processedImage} 
                    alt={showOriginal ? "Original" : "Processed"}
                    className="w-full h-full object-contain"
                  />
                )}
                {!imageUrl && (
                  <div className="flex items-center justify-center h-full text-text-muted">
                    <ImageIcon className="w-12 h-12 opacity-30" />
                  </div>
                )}
                
                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                    <RefreshCw className="w-12 h-12 text-neon-cyan animate-spin mb-4" />
                    <p className="text-neon-cyan font-medium animate-pulse">Removing background...</p>
                    <p className="text-xs text-text-muted mt-2">This may take a few seconds</p>
                  </div>
                )}
              </div>

              {/* Toggle Original/Processed */}
              {result && (
                <div className="flex justify-center mt-4">
                  <div className="flex bg-void-light rounded-lg p-1 border border-white/10">
                    <button
                      onClick={() => setShowOriginal(false)}
                      className={`px-4 py-2 rounded-md text-sm transition-all ${!showOriginal ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-text-muted'}`}
                    >
                      Result
                    </button>
                    <button
                      onClick={() => setShowOriginal(true)}
                      className={`px-4 py-2 rounded-md text-sm transition-all ${showOriginal ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-text-muted'}`}
                    >
                      Original
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Controls Sidebar */}
            <div className="w-full lg:w-80 p-6 border-l border-white/10 bg-void-light">
              <div className="space-y-6">
                {/* Settings */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-4 h-4 text-text-muted" />
                    <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Settings</h3>
                  </div>

                  {/* Tolerance */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <label className="text-sm text-text-secondary">Color Tolerance</label>
                      <span className="text-sm text-neon-cyan">{tolerance}</span>
                    </div>
                    <Slider
                      value={[tolerance]}
                      onValueChange={(v) => setTolerance(v[0])}
                      min={10}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-text-muted">Higher values remove more similar colors</p>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={edgeDetection}
                        onChange={(e) => setEdgeDetection(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-void text-neon-cyan focus:ring-neon-cyan"
                      />
                      <span className="text-sm text-text-secondary">Edge smoothing</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={featherEdges}
                        onChange={(e) => setFeatherEdges(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 bg-void text-neon-cyan focus:ring-neon-cyan"
                      />
                      <span className="text-sm text-text-secondary">Feather edges</span>
                    </label>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                {/* Result Info */}
                {result && (
                  <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-neon-cyan" />
                      <span className="text-sm font-bold text-neon-cyan">Processing Complete</span>
                    </div>
                    <p className="text-xs text-text-muted">
                      Processed in {result.processingTime.toFixed(0)}ms
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  {!result ? (
                    <Button
                      onClick={handleRemoveBackground}
                      disabled={isProcessing || !imageUrl}
                      className="w-full bg-gradient-to-r from-neon-cyan to-neon-blue text-void font-bold"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          Remove Background
                        </>
                      )}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleUseResult}
                        className="w-full bg-gradient-to-r from-neon-cyan to-neon-blue text-void font-bold"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Use This Image
                      </Button>
                      <Button
                        onClick={handleDownload}
                        variant="outline"
                        className="w-full border-white/20"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download PNG
                      </Button>
                      <Button
                        onClick={() => {
                          setResult(null);
                          setError(null);
                        }}
                        variant="ghost"
                        className="w-full text-text-muted"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Start Over
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BackgroundRemovalModal;
