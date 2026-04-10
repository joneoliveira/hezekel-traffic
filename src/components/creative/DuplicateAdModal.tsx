import { useState, useRef, useCallback } from 'react';
import { Loader2, Upload, X, CheckCircle2, ImageIcon, Circle, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AdCreative } from '@/hooks/useCreativeIntelligence';
import { useAccountContext } from '@/contexts/AccountContext';

const STEPS = [
  'Fazendo upload da mídia...',
  'Lendo dados do anúncio original...',
  'Montando novo criativo...',
  'Salvando novo criativo na Meta...',
  'Publicando novo anúncio (Pausado)...',
] as const;

type StepStatus = 'pending' | 'active' | 'done';
type StepEvent =
  | { type: 'step'; step: number; label: string }
  | { type: 'done'; adId: string; name: string }
  | { type: 'error'; message: string; metaError?: { error_user_msg?: string; error_user_title?: string } };

type CreatedAd = { adId: string; name: string };

interface MediaItem {
  file: File;
  previewUrl: string;
}

function ProgressStepper({ currentStep, stepLabels }: { currentStep: number; stepLabels: string[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {stepLabels.map((label, i) => {
        const stepNum = i + 1;
        const status: StepStatus = currentStep > stepNum ? 'done' : currentStep === stepNum ? 'active' : 'pending';
        return (
          <li key={label} className={cn(
            'flex items-center gap-3 text-sm transition-colors duration-200',
            status === 'done' && 'text-foreground',
            status === 'active' && 'text-foreground font-medium',
            status === 'pending' && 'text-muted-foreground'
          )}>
            <span className="shrink-0 w-5 h-5 flex items-center justify-center">
              {status === 'done' && <CheckCircle2 size={18} className="text-green-600" />}
              {status === 'active' && <Loader2 size={16} className="animate-spin text-primary" />}
              {status === 'pending' && <Circle size={16} className="text-muted-foreground/40" />}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

interface Props {
  ad: AdCreative | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newAdId: string, newAdName: string) => void;
}

export function DuplicateAdModal({ ad, open, onOpenChange, onSuccess }: Props) {
  const [customName, setCustomName] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentCopy, setCurrentCopy] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [createdAds, setCreatedAds] = useState<CreatedAd[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { activeAccount } = useAccountContext();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const totalCopies = mediaItems.length || 1;

  function addFiles(files: FileList | File[]) {
    const newItems: MediaItem[] = Array.from(files).map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setMediaItems(prev => [...prev, ...newItems]);
  }

  function removeMedia(index: number) {
    setMediaItems(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }, []);

  async function runOneDuplicate(adId: string, mediaFile: File | null, name?: string): Promise<CreatedAd> {
    const formData = new FormData();
    if (name) formData.append('name', name);
    if (mediaFile) formData.append('media', mediaFile);

    const res = await fetch(`${supabaseUrl}/functions/v1/meta-duplicate-ad`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'x-ad-id': adId,
        ...(activeAccount?.ad_account_id ? { 'x-account-id': activeAccount.ad_account_id } : {}),
      },
      body: formData,
    });

    if (!res.body) throw new Error('Resposta sem corpo');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Process any remaining data in the buffer (can happen if stream closed mid-chunk)
        const remaining = buffer.trim();
        if (remaining) {
          try {
            const event: StepEvent = JSON.parse(remaining);
            if (event.type === 'done') {
              setCurrentStep(STEPS.length + 1);
              return { adId: event.adId, name: event.name };
            }
            if (event.type === 'error') {
              const detail = event.metaError?.error_user_msg || event.metaError?.error_user_title || null;
              throw new Error(detail ? `${event.message}\n\n${detail}` : event.message);
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        let event: StepEvent;
        try { event = JSON.parse(line); } catch { continue; }

        if (event.type === 'step') {
          setCurrentStep(event.step);
        } else if (event.type === 'done') {
          setCurrentStep(STEPS.length + 1);
          return { adId: event.adId, name: event.name };
        } else if (event.type === 'error') {
          const detail = event.metaError?.error_user_msg || event.metaError?.error_user_title || null;
          throw new Error(detail ? `${event.message}\n\n${detail}` : event.message);
        }
      }
    }
    throw new Error('Conexão encerrada pelo servidor antes da conclusão. O vídeo pode ter demorado demais para processar — verifique no Gerenciador de Anúncios se foi criado antes de tentar novamente.');
  }

  async function handleDuplicate() {
    if (!ad) return;
    setIsRunning(true);
    setErrorMsg(null);
    setCreatedAds([]);
    const results: CreatedAd[] = [];

    try {
      if (mediaItems.length === 0) {
        // No media: single copy
        setCurrentCopy(1);
        setCurrentStep(1);
        const name = customName.trim() || undefined;
        const created = await runOneDuplicate(ad.ad_id, null, name);
        results.push(created);
        setCreatedAds([...results]);
        onSuccess?.(created.adId, created.name);
      } else {
        // One copy per media file — use filename (without extension) as ad name
        for (let i = 0; i < mediaItems.length; i++) {
          setCurrentCopy(i + 1);
          setCurrentStep(1);
          const file = mediaItems[i].file;
          const nameFromFile = file.name.replace(/\.[^/.]+$/, '');
          const created = await runOneDuplicate(ad.ad_id, file, nameFromFile);
          results.push(created);
          setCreatedAds([...results]);
          onSuccess?.(created.adId, created.name);
        }
      }
      setIsDone(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao conectar com o servidor');
    } finally {
      setIsRunning(false);
      setCurrentStep(0);
    }
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setCustomName('');
      mediaItems.forEach(m => URL.revokeObjectURL(m.previewUrl));
      setMediaItems([]);
      setIsDone(false);
      setIsRunning(false);
      setCurrentCopy(0);
      setCurrentStep(0);
      setCreatedAds([]);
      setErrorMsg(null);
    }
    onOpenChange(nextOpen);
  }

  const sourceThumbnail = ad?.image_url || ad?.thumbnail_url || ad?.media_best_url || null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicar Anúncio</DialogTitle>
        </DialogHeader>

        {isDone ? (
          <div className="flex flex-col gap-5">
            {totalCopies === 1 ? (
              <ProgressStepper currentStep={STEPS.length + 1} stepLabels={[...STEPS]} />
            ) : null}
            <div className="flex flex-col items-center gap-3 pt-2 text-center border-t border-border">
              <CheckCircle2 size={36} className="text-green-600" />
              <p className="font-semibold">
                {totalCopies === 1 ? 'Anúncio duplicado com sucesso!' : `${totalCopies} anúncios criados com sucesso!`}
              </p>
            </div>
            {createdAds.length > 0 && (
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-md border border-border bg-muted p-3">
                {createdAds.map((a, i) => (
                  <div key={a.adId} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-muted-foreground shrink-0">#{i + 1}</span>
                    <span className="font-medium truncate flex-1">{a.name}</span>
                    <code className="text-muted-foreground font-mono bg-background px-1.5 py-0.5 rounded shrink-0">{a.adId}</code>
                  </div>
                ))}
              </div>
            )}
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          </div>
        ) : isRunning ? (
          <div className="flex flex-col gap-4 py-2">
            {totalCopies > 1 && (
              <p className="text-sm font-medium text-muted-foreground">
                Criando cópia {currentCopy} de {totalCopies}...
              </p>
            )}
            <ProgressStepper currentStep={currentStep} stepLabels={[...STEPS]} />
            {createdAds.length > 0 && (
              <div className="flex flex-col gap-1 rounded-md border border-border bg-muted p-3">
                <p className="text-xs text-muted-foreground mb-1">Concluídos:</p>
                {createdAds.map((a, i) => (
                  <div key={a.adId} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 size={12} className="text-green-600 shrink-0" />
                    <span className="font-medium truncate">{a.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {ad && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-muted border border-border">
                <div className="w-12 h-12 rounded-md bg-background border border-border overflow-hidden flex items-center justify-center shrink-0">
                  {sourceThumbnail
                    ? <img src={sourceThumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                    : <ImageIcon size={16} className="text-muted-foreground" />}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-medium truncate">{ad.ad_name}</p>
                  <p className="text-xs text-muted-foreground">{ad.adset_name}</p>
                </div>
              </div>
            )}

            {/* Media list */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Mídias</Label>
                {mediaItems.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {mediaItems.length} {mediaItems.length === 1 ? 'arquivo' : 'arquivos'} → {mediaItems.length} {mediaItems.length === 1 ? 'cópia' : 'cópias'}
                  </span>
                )}
              </div>

              {mediaItems.length > 0 && (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {mediaItems.map((item, i) => {
                    const isVideo = item.file.type.startsWith('video/');
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/50">
                        <div className="w-9 h-9 rounded overflow-hidden border border-border bg-background flex items-center justify-center shrink-0">
                          {isVideo
                            ? <Film size={14} className="text-muted-foreground" />
                            : <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="text-xs truncate flex-1 text-muted-foreground">{item.file.name}</span>
                        <button
                          onClick={() => removeMedia(i)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Drop zone */}
              <div
                role="button" tabIndex={0}
                className={cn(
                  'border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer transition-colors',
                  isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
                )}
                onClick={() => inputRef.current?.click()}
                onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Upload size={18} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  {mediaItems.length === 0
                    ? <>Arraste ou <span className="text-foreground font-medium">clique para selecionar</span></>
                    : <span className="text-foreground font-medium">Adicionar mais arquivos</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {mediaItems.length === 0
                    ? 'Selecione 1 ou mais imagens/vídeos. Sem mídia = 1 cópia sem troca.'
                    : 'Imagens ou vídeos'}
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="sr-only"
                onChange={e => { if (e.target.files?.length) { addFiles(e.target.files); e.target.value = ''; } }}
              />
            </div>

            {/* Custom name — only when no media or single file */}
            {mediaItems.length <= 1 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="dup-name">Nome do novo anúncio</Label>
                <Input
                  id="dup-name"
                  placeholder="Deixe em branco para gerar automaticamente (_VAR01)"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                />
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm whitespace-pre-wrap">{errorMsg}</div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleDuplicate} disabled={isRunning}>
                {isRunning && <Loader2 size={14} className="animate-spin mr-2" />}
                {mediaItems.length > 1
                  ? `Criar ${mediaItems.length} cópias`
                  : 'Duplicar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
