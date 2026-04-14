import { Play } from 'lucide-react';

interface CreativePreviewProps {
  adPreviewHtml?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  mediaBestUrl?: string | null;
  videoThumbnailUrl?: string | null;
  videoSource?: string | null;
  creativeType?: string | null;
  adName: string;
  className?: string;
  mode?: 'card' | 'modal';
}

function decodeHtml(html: string): string {
  return html
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
}

export default function CreativePreview({
  adPreviewHtml, imageUrl, thumbnailUrl, mediaBestUrl,
  videoThumbnailUrl, videoSource, creativeType, adName,
  className = 'aspect-video', mode = 'card',
}: CreativePreviewProps) {
  const isVideo = creativeType === 'video';

  if (mode === 'modal') {
    if (videoSource) return (
      <div className={`${className} bg-black relative overflow-hidden`}>
        <video src={videoSource} controls className="w-full h-full object-contain"
          poster={videoThumbnailUrl || imageUrl || thumbnailUrl || undefined} />
      </div>
    );
    if (imageUrl) return (
      <div className={`${className} bg-muted relative overflow-hidden flex items-center justify-center`}>
        <img src={imageUrl} alt={adName} className="max-w-full max-h-full object-contain" />
      </div>
    );
    if (adPreviewHtml) {
      const decoded = decodeHtml(adPreviewHtml);
      return (
        <div className="bg-muted flex items-center justify-center py-4">
          <div className="flex-shrink-0" style={{ width: 420, height: 690 }}>
            <iframe srcDoc={decoded} sandbox="allow-scripts allow-same-origin"
              className="w-full h-full border-0" title={`Preview: ${adName}`} loading="eager" />
          </div>
        </div>
      );
    }
    const fallback = mediaBestUrl || videoThumbnailUrl || thumbnailUrl;
    if (fallback) return (
      <div className={`${className} bg-muted relative overflow-hidden flex items-center justify-center`}>
        <img src={fallback} alt={adName} className="max-w-full max-h-full object-contain" />
      </div>
    );
    return <div className={`${className} bg-muted flex items-center justify-center text-muted-foreground text-sm`}>Sem preview</div>;
  }

  const cardImage = imageUrl || videoThumbnailUrl || thumbnailUrl || mediaBestUrl;
  if (cardImage) return (
    <div className={`${className} bg-muted relative overflow-hidden`}>
      <img src={cardImage} alt={adName} className="w-full h-full object-cover" loading="lazy" />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
        </div>
      )}
    </div>
  );

  return <div className={`${className} bg-muted flex items-center justify-center text-muted-foreground text-sm`}>Sem preview</div>;
}
