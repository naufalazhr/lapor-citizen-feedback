import { useState } from "react";
import { Download, FileIcon, ImageIcon, FileVideo, FileAudio, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Attachment {
  id: string;
  filename: string;
  extension: string;
  mime_type: string;
  file_size: number | null;
  storage_url: string;
  storage_path: string;
  download_status: string;
  upload_status: string;
  error_message: string | null;
}

interface AttachmentDisplayProps {
  attachment: Attachment;
  compact?: boolean;
}

const AttachmentDisplay = ({ attachment, compact = false }: AttachmentDisplayProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Check if attachment processing failed
  const hasFailed = attachment.download_status === 'failed' || attachment.upload_status === 'failed';

  // Determine file type
  const isImage = attachment.mime_type.startsWith('image/');
  const isVideo = attachment.mime_type.startsWith('video/');
  const isAudio = attachment.mime_type.startsWith('audio/');
  const isDocument = !isImage && !isVideo && !isAudio;

  // Format file size
  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get file icon
  const getFileIcon = () => {
    if (isImage) return <ImageIcon className="h-4 w-4" />;
    if (isVideo) return <FileVideo className="h-4 w-4" />;
    if (isAudio) return <FileAudio className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  // Handle download
  const handleDownload = () => {
    window.open(attachment.storage_url, '_blank');
  };

  // If attachment failed, show error state
  if (hasFailed) {
    return (
      <div className="border border-destructive rounded-lg p-3 bg-destructive/10 mt-2">
        <div className="flex items-start gap-2">
          <FileIcon className="h-4 w-4 text-destructive mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              Attachment Failed
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {attachment.filename}
            </p>
            {attachment.error_message && (
              <p className="text-xs text-destructive mt-1">
                {attachment.error_message}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Compact view (for list view)
  if (compact) {
    return (
      <div className="flex items-center gap-2 mt-2">
        <Badge variant="outline" className="gap-1">
          {getFileIcon()}
          {attachment.filename}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDownload}
          className="h-6 px-2"
        >
          <Download className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Full view for images
  if (isImage && !imageError) {
    return (
      <>
        <div className="mt-2 space-y-2">
          <div className="relative rounded-lg overflow-hidden border bg-muted">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <img
              src={attachment.storage_url}
              alt={attachment.filename}
              className={`w-full max-w-md cursor-pointer transition-opacity ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
              onClick={() => setPreviewOpen(true)}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="truncate flex items-center gap-1">
              {getFileIcon()}
              {attachment.filename}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownload}
              className="h-6 px-2 gap-1"
            >
              <Download className="h-3 w-3" />
              Download
            </Button>
          </div>
        </div>

        {/* Full screen preview dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                {attachment.filename}
              </DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={attachment.storage_url}
                alt={attachment.filename}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
            <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
              <span>{formatFileSize(attachment.file_size)}</span>
              <Button onClick={handleDownload} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Full view for video — native controls include fullscreen, no dialog needed
  if (isVideo) {
    return (
      <div className="mt-2 space-y-2">
        <div className="rounded-lg overflow-hidden border bg-black">
          <video
            src={attachment.storage_url}
            controls
            preload="metadata"
            className="w-full max-w-md"
            style={{ maxHeight: '300px' }}
          >
            Browser Anda tidak mendukung pemutaran video.
          </video>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate flex items-center gap-1">
            {getFileIcon()}
            {attachment.filename}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="h-6 px-2 gap-1"
          >
            <Download className="h-3 w-3" />
            Download
          </Button>
        </div>
      </div>
    );
  }

  // Full view for other file types
  return (
    <div className="border rounded-lg p-3 bg-muted/50 mt-2">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-background rounded border">
          {getFileIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {attachment.filename}
          </p>
          <p className="text-xs text-muted-foreground">
            {attachment.extension.toUpperCase()} • {formatFileSize(attachment.file_size)}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDownload}
          className="gap-2 shrink-0"
        >
          <ExternalLink className="h-3 w-3" />
          Open
        </Button>
      </div>
    </div>
  );
};

export default AttachmentDisplay;
