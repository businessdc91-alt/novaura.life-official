import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Upload,
  X,
  FileArchive,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  File,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  CloudUpload,
} from "lucide-react";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type UploadStatus = "idle" | "uploading" | "completed" | "error" | "paused";

export interface FileWithProgress {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: UploadStatus;
  error?: string;
  previewUrl?: string;
}

export interface FileUploaderProps {
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedTypes?: string[];
  onUpload?: (files: File[]) => Promise<void>;
  onProgress?: (fileName: string, progress: number) => void;
  uploadEndpoint?: string;
  className?: string;
  onFilesSelected?: (files: FileWithProgress[]) => void;
  onFileRemove?: (fileId: string) => void;
  onUploadComplete?: (files: FileWithProgress[]) => void;
}

export interface UploadProgressProps {
  file: FileWithProgress;
  onRemove?: (fileId: string) => void;
  onRetry?: (fileId: string) => void;
  showActions?: boolean;
}

export interface FilePreviewProps {
  file: FileWithProgress;
  size?: "sm" | "md" | "lg";
}

export interface UploadQueueProps {
  files: FileWithProgress[];
  onRemove?: (fileId: string) => void;
  onRetry?: (fileId: string) => void;
  onClearAll?: () => void;
  onUploadAll?: () => void;
  isUploading?: boolean;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getFileExtension = (filename: string): string => {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
};

const isAcceptedFileType = (file: File, acceptedTypes?: string[]): boolean => {
  if (!acceptedTypes || acceptedTypes.length === 0) return true;
  
  const extension = `.${getFileExtension(file.name)}`;
  return acceptedTypes.some(type => {
    if (type.includes("/*")) {
      const baseType = type.replace("/*", "");
      return file.type.startsWith(baseType);
    }
    return type.toLowerCase() === extension.toLowerCase();
  });
};

const createFileWithProgress = async (file: File): Promise<FileWithProgress> => {
  let previewUrl: string | undefined;
  
  if (file.type.startsWith("image/")) {
    previewUrl = URL.createObjectURL(file);
  }
  
  return {
    id: generateId(),
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    progress: 0,
    status: "idle",
    previewUrl,
  };
};

// =============================================================================
// FILE PREVIEW COMPONENT
// =============================================================================

export const FilePreview: React.FC<FilePreviewProps> = ({ file, size = "md" }) => {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const iconSizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  const getFileIcon = () => {
    if (file.type.startsWith("image/")) {
      if (file.previewUrl) {
        return (
          <img
            src={file.previewUrl}
            alt={file.name}
            className={cn("object-cover rounded-lg", sizeClasses[size])}
          />
        );
      }
      return <FileImage className={cn("text-neon-cyan", iconSizeClasses[size])} />;
    }
    if (file.type.startsWith("video/")) {
      return <FileVideo className={cn("text-neon-magenta", iconSizeClasses[size])} />;
    }
    if (file.type.startsWith("audio/")) {
      return <FileAudio className={cn("text-neon-violet", iconSizeClasses[size])} />;
    }
    if (file.type === "application/zip" || file.name.endsWith(".zip")) {
      return <FileArchive className={cn("text-neon-lime", iconSizeClasses[size])} />;
    }
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      return <FileText className={cn("text-text-secondary", iconSizeClasses[size])} />;
    }
    return <File className={cn("text-text-secondary", iconSizeClasses[size])} />;
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-void-light border border-white/5 overflow-hidden shrink-0",
        sizeClasses[size]
      )}
    >
      {getFileIcon()}
    </div>
  );
};

// =============================================================================
// UPLOAD PROGRESS COMPONENT
// =============================================================================

export const UploadProgress: React.FC<UploadProgressProps> = ({
  file,
  onRemove,
  onRetry,
  showActions = true,
}) => {
  const getStatusIcon = () => {
    switch (file.status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-neon-lime" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-neon-red" />;
      case "uploading":
        return (
          <div className="w-5 h-5 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin" />
        );
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (file.status) {
      case "completed":
        return "bg-neon-lime";
      case "error":
        return "bg-neon-red";
      case "uploading":
        return "bg-gradient-rgb";
      default:
        return "bg-void-lighter";
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 p-3 rounded-xl",
        "bg-void-light border border-white/5",
        "transition-all duration-300",
        "hover:border-neon-cyan/20 hover:shadow-glow-cyan/5",
        file.status === "error" && "border-neon-red/30 bg-neon-red/5",
        file.status === "completed" && "border-neon-lime/20 bg-neon-lime/5"
      )}
    >
      <FilePreview file={file} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-sm font-medium text-text-primary truncate">
            {file.name}
          </p>
          <span className="text-xs text-text-muted font-mono shrink-0">
            {formatFileSize(file.size)}
          </span>
        </div>

        <div className="relative h-1.5 bg-void rounded-full overflow-hidden">
          <div
            className={cn(
              "absolute inset-y-0 left-0 transition-all duration-300 rounded-full",
              getStatusColor(),
              file.status === "uploading" && "animate-pulse"
            )}
            style={{ width: `${file.progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-text-muted">
            {file.status === "uploading" && `${file.progress}%`}
            {file.status === "completed" && "Uploaded successfully"}
            {file.status === "error" && file.error}
            {file.status === "idle" && "Ready to upload"}
          </span>
          {getStatusIcon()}
        </div>
      </div>

      {showActions && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {file.status === "error" && onRetry && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-neon-cyan hover:text-neon-cyan hover:bg-neon-cyan/10"
              onClick={() => onRetry(file.id)}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-text-muted hover:text-neon-red hover:bg-neon-red/10"
              onClick={() => onRemove(file.id)}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// UPLOAD QUEUE COMPONENT
// =============================================================================

export const UploadQueue: React.FC<UploadQueueProps> = ({
  files,
  onRemove,
  onRetry,
  onClearAll,
  onUploadAll,
  isUploading = false,
}) => {
  if (files.length === 0) {
    return null;
  }

  const completedCount = files.filter((f) => f.status === "completed").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const uploadingCount = files.filter((f) => f.status === "uploading").length;
  const pendingCount = files.filter((f) => f.status === "idle").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-text-primary">
            Upload Queue ({files.length})
          </h3>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-neon-lime/10 text-neon-lime border border-neon-lime/20">
                {completedCount} done
              </span>
            )}
            {errorCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-neon-red/10 text-neon-red border border-neon-red/20">
                {errorCount} failed
              </span>
            )}
            {uploadingCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/20 animate-pulse">
                {uploadingCount} uploading
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && onUploadAll && !isUploading && (
            <Button
              variant="default"
              size="sm"
              onClick={onUploadAll}
              className="bg-gradient-rgb hover:opacity-90 text-void font-medium"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload All
            </Button>
          )}
          {onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="text-text-muted hover:text-neon-red hover:bg-neon-red/10"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
        {files.map((file) => (
          <UploadProgress
            key={file.id}
            file={file}
            onRemove={onRemove}
            onRetry={onRetry}
          />
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN FILE UPLOADER COMPONENT
// =============================================================================

export const FileUploader: React.FC<FileUploaderProps> = ({
  maxFiles = 10,
  maxSizeMB = 100,
  acceptedTypes,
  onUpload,
  onProgress,
  uploadEndpoint: _uploadEndpoint,
  className,
  onFilesSelected,
  onFileRemove,
  onUploadComplete,
}) => {
  const [files, setFiles] = React.useState<FileWithProgress[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dragCounter = React.useRef(0);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }
    if (!isAcceptedFileType(file, acceptedTypes)) {
      return `File type not accepted. Allowed: ${acceptedTypes?.join(", ") || "All files"}`;
    }
    return null;
  };

  const addFiles = async (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;

    setError(null);

    if (files.length + newFiles.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validFiles: FileWithProgress[] = [];
    const errors: string[] = [];

    for (const file of Array.from(newFiles)) {
      const validationError = validateFile(file);
      if (validationError) {
        errors.push(`${file.name}: ${validationError}`);
      } else {
        const fileWithProgress = await createFileWithProgress(file);
        validFiles.push(fileWithProgress);
      }
    }

    if (errors.length > 0) {
      setError(errors.join("; "));
    }

    if (validFiles.length > 0) {
      const updatedFiles = [...files, ...validFiles];
      setFiles(updatedFiles);
      onFilesSelected?.(validFiles);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.id === fileId);
      if (file?.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      const updated = prev.filter((f) => f.id !== fileId);
      return updated;
    });
    onFileRemove?.(fileId);
  };

  const clearAllFiles = () => {
    files.forEach((file) => {
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
    });
    setFiles([]);
    setError(null);
  };

  const updateFileStatus = (fileId: string, status: UploadStatus, error?: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status, error } : f))
    );
  };

  const simulateUpload = async (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return;

    updateFileStatus(fileId, "uploading");

    // Simulate upload progress
    const interval = setInterval(() => {
      setFiles((prev) => {
        const currentFile = prev.find((f) => f.id === fileId);
        if (!currentFile || currentFile.progress >= 100) {
          clearInterval(interval);
          return prev;
        }
        const newProgress = Math.min(currentFile.progress + Math.random() * 15 + 5, 100);
        onProgress?.(currentFile.name, newProgress);
        return prev.map((f) =>
          f.id === fileId ? { ...f, progress: newProgress } : f
        );
      });
    }, 200);

    // Simulate completion after progress reaches 100
    setTimeout(() => {
      clearInterval(interval);
      updateFileStatus(fileId, "completed");
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, progress: 100 } : f))
      );
    }, 2500);
  };

  const uploadSingleFile = async (file: FileWithProgress): Promise<void> => {
    if (onUpload) {
      try {
        updateFileStatus(file.id, "uploading");
        
        // Create a wrapper to track progress
        await onUpload([file.file]);
        updateFileStatus(file.id, "completed");
      } catch (err) {
        updateFileStatus(file.id, "error", err instanceof Error ? err.message : "Upload failed");
      }
    } else {
      // Simulate upload if no onUpload handler provided
      await simulateUpload(file.id);
    }
  };

  const uploadAllFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === "idle" || f.status === "error");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    if (onUpload) {
      try {
        await onUpload(pendingFiles.map((f) => f.file));
        pendingFiles.forEach((f) => updateFileStatus(f.id, "completed"));
      } catch (err) {
        pendingFiles.forEach((f) =>
          updateFileStatus(f.id, "error", err instanceof Error ? err.message : "Upload failed")
        );
      }
    } else {
      // Simulate sequential uploads
      for (const file of pendingFiles) {
        await simulateUpload(file.id);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    setIsUploading(false);
    onUploadComplete?.(files);
  };

  const retryFile = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    if (file) {
      uploadSingleFile(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = ""; // Reset input
  };

  // Cleanup preview URLs on unmount
  React.useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, []);

  const acceptedTypesString = acceptedTypes?.join(",") || "";
  const hasFiles = files.length > 0;
  const allCompleted = files.length > 0 && files.every((f) => f.status === "completed");

  return (
    <div className={cn("space-y-6", className)}>
      {/* Drag & Drop Zone */}
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "relative group cursor-pointer",
          "flex flex-col items-center justify-center",
          "min-h-[200px] p-8 rounded-2xl",
          "border-2 border-dashed transition-all duration-300",
          "bg-void-light/50",
          isDragging
            ? "border-neon-cyan bg-neon-cyan/5 shadow-glow-cyan"
            : "border-white/10 hover:border-white/20 hover:bg-void-light",
          allCompleted && "border-neon-lime/30 bg-neon-lime/5"
        )}
      >
        {/* Animated border on drag */}
        {isDragging && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div
              className="absolute inset-[-100%] animate-spin-slow"
              style={{
                background: "conic-gradient(from 0deg, transparent 0%, #00F0FF 25%, #8B5CF6 50%, #FF006E 75%, transparent 100%)",
                opacity: 0.3,
              }}
            />
          </div>
        )}

        <div
          className={cn(
            "relative z-10 flex flex-col items-center gap-4 text-center",
            isDragging && "scale-105 transition-transform duration-200"
          )}
        >
          <div
            className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
              isDragging
                ? "bg-neon-cyan/20 shadow-glow-cyan"
                : "bg-void-lighter group-hover:bg-void-lighter/80"
            )}
          >
            <CloudUpload
              className={cn(
                "w-8 h-8 transition-all duration-300",
                isDragging ? "text-neon-cyan scale-110" : "text-text-muted group-hover:text-text-secondary"
              )}
            />
          </div>

          <div className="space-y-1">
            <p className="text-lg font-medium text-text-primary">
              {isDragging ? "Drop files here" : "Drop files here or click to browse"}
            </p>
            <p className="text-sm text-text-muted">
              Maximum file size: {maxSizeMB}MB
              {maxFiles > 1 && ` • Up to ${maxFiles} files`}
            </p>
          </div>

          {acceptedTypes && acceptedTypes.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {acceptedTypes.map((type) => (
                <span
                  key={type}
                  className="text-xs px-2 py-1 rounded-full bg-void-lighter text-text-muted border border-white/5"
                >
                  {type.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={acceptedTypesString}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-neon-red/10 border border-neon-red/20 text-neon-red text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Upload Queue */}
      {hasFiles && (
        <UploadQueue
          files={files}
          onRemove={removeFile}
          onRetry={retryFile}
          onClearAll={clearAllFiles}
          onUploadAll={uploadAllFiles}
          isUploading={isUploading}
        />
      )}

      {/* Success Message */}
      {allCompleted && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-neon-lime/10 border border-neon-lime/20 text-neon-lime text-sm animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p>All files uploaded successfully!</p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// NAMED EXPORTS
// =============================================================================

export default FileUploader;
