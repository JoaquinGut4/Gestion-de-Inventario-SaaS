import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Keyboard, RefreshCw, ScanLine } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ApiError, apiRequest } from '@/lib/api';
import { inventoryFromApi } from '@/lib/operationsApi';
import type { InventarioRegistro } from '@/types';

interface InventoryScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFound: (registro: InventarioRegistro) => void;
}

type ScannerStatus = 'idle' | 'requesting' | 'scanning' | 'decoding' | 'searching' | 'denied' | 'unavailable' | 'insecure' | 'not-found';
type ScannerControls = { stop: () => void };
type NativeBarcodeDetector = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
type NativeBarcodeDetectorConstructor = new (options: { formats: string[] }) => NativeBarcodeDetector;

const STATUS_TEXT: Record<ScannerStatus, string> = {
  idle: 'Pulsa “Activar cámara” para comenzar.',
  requesting: 'Solicitando permiso para usar la cámara...',
  scanning: 'Apunta la cámara al código QR del producto.',
  decoding: 'Analizando la foto del código QR...',
  searching: 'Código detectado. Buscando el producto...',
  denied: 'No se concedió permiso para usar la cámara. Puedes ingresar el código manualmente.',
  unavailable: 'No hay una cámara disponible. Puedes ingresar el código manualmente.',
  insecure: 'La vista en vivo requiere HTTPS. En esta conexión puedes tomar una foto del QR para identificar el producto.',
  'not-found': 'El QR no pertenece a ningún producto registrado.',
};

export function InventoryScannerModal({ isOpen, onClose, onFound }: InventoryScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const lockedRef = useRef(false);
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const findProduct = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code || lockedRef.current) return;
    lockedRef.current = true;
    setStatus('searching');
    setError('');
    stopCamera();
    try {
      const registro = await apiRequest<InventarioRegistro>(`/inventario/por-qr?codigo=${encodeURIComponent(code)}`);
      navigator.vibrate?.(80);
      onFound(inventoryFromApi(registro));
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 404) {
        setStatus('not-found');
        setError(`No se encontró un producto con el código “${code}”.`);
      } else {
        setStatus('idle');
        setError(requestError instanceof Error ? requestError.message : 'No se pudo consultar el producto.');
      }
      window.setTimeout(() => { lockedRef.current = false; }, 800);
    }
  }, [onFound, stopCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    lockedRef.current = false;
    setError('');
    setStatus('requesting');
    try {
      if (!window.isSecureContext) {
        setStatus('insecure');
        setError('La cámara requiere una conexión HTTPS segura en la tablet.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }
      const NativeDetector = (window as typeof window & { BarcodeDetector?: NativeBarcodeDetectorConstructor }).BarcodeDetector;
      if (NativeDetector) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const detector = new NativeDetector({ formats: ['qr_code'] });
        let active = true;
        let frame = 0;
        const scan = async () => {
          if (!active || lockedRef.current) return;
          try {
            const [result] = await detector.detect(video);
            if (result?.rawValue) {
              void findProduct(result.rawValue);
              return;
            }
          } catch {
            // Un cuadro sin lectura no es un error de cámara.
          }
          if (active) frame = window.requestAnimationFrame(() => void scan());
        };
        controlsRef.current = {
          stop: () => {
            active = false;
            window.cancelAnimationFrame(frame);
            stream.getTracks().forEach((track) => track.stop());
          },
        };
        setStatus('scanning');
        frame = window.requestAnimationFrame(() => void scan());
        return;
      }
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 700 });
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        videoRef.current!,
        (result) => {
          if (result) void findProduct(result.getText());
        },
      );
      controlsRef.current = controls;
      setStatus('scanning');
    } catch (cameraError) {
      const name = cameraError instanceof DOMException ? cameraError.name : '';
      setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable');
      setError(cameraError instanceof Error ? cameraError.message : 'No se pudo iniciar la cámara.');
    }
  }, [findProduct, stopCamera]);

  const decodeCapturedImage = useCallback(async (file: File) => {
    lockedRef.current = false;
    setStatus('decoding');
    setError('');
    const imageUrl = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const result = await reader.decodeFromImageUrl(imageUrl);
      await findProduct(result.getText());
    } catch {
      setStatus('not-found');
      setError('No se encontró un código QR legible en la foto. Acércate más y vuelve a intentarlo.');
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }, [findProduct]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    setStatus(window.isSecureContext ? 'idle' : 'insecure');
    setManualCode('');
    setError('');
    lockedRef.current = false;
    return stopCamera;
  }, [isOpen, stopCamera]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { stopCamera(); onClose(); }}
      labelledBy="inventory-scanner-title"
      title="Escanear código QR"
      subtitle="Identifica el producto y abre sus especificaciones"
      icon={<ScanLine className="h-4 w-4" />}
      headerClass="bg-slate-900"
      panelClass="max-w-xl"
    >
      <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-950">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          {status !== 'scanning' && status !== 'searching' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-300">
              {status === 'denied' || status === 'unavailable' || status === 'insecure' ? <CameraOff className="h-10 w-10" /> : <Camera className="h-10 w-10" />}
              <p className="max-w-sm text-xs leading-relaxed">{STATUS_TEXT[status]}</p>
            </div>
          )}
          {status === 'scanning' && (
            <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-success shadow-[0_0_0_999px_rgba(2,6,23,.45)]">
              <span className="absolute -left-0.5 -top-0.5 h-8 w-8 border-l-4 border-t-4 border-white" />
              <span className="absolute -right-0.5 -top-0.5 h-8 w-8 border-r-4 border-t-4 border-white" />
              <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 border-b-4 border-l-4 border-white" />
              <span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 border-b-4 border-r-4 border-white" />
            </div>
          )}
        </div>

        <p role="status" className={`rounded-lg border px-3 py-2 text-xs font-semibold ${status === 'not-found' || error ? 'border-danger/30 bg-danger/10 text-danger' : 'border-highlight/35 bg-brand-soft text-brand'}`}>
          {error || STATUS_TEXT[status]}
        </p>

        {window.isSecureContext ? (
          <button
            type="button"
            onClick={() => void startCamera()}
            disabled={status === 'requesting' || status === 'searching' || status === 'decoding'}
            className="inline-flex w-full touch-manipulation select-none items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white active:scale-[.98] disabled:opacity-50"
          >
            {status === 'scanning' ? <RefreshCw className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
            {status === 'scanning' ? 'Reiniciar cámara' : 'Activar cámara'}
          </button>
        ) : (
          <>
            <input
              ref={captureInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void decodeCapturedImage(file);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => captureInputRef.current?.click()}
              disabled={status === 'searching' || status === 'decoding'}
              className="inline-flex w-full touch-manipulation select-none items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white active:scale-[.98] disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              Tomar foto del QR
            </button>
          </>
        )}

        <div className="border-t border-slate-200 pt-4">
          <label htmlFor="manual-qr" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-600">
            <Keyboard className="h-3.5 w-3.5" /> Ingresar código manualmente
          </label>
          <div className="flex gap-2">
            <input
              id="manual-qr"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void findProduct(manualCode); } }}
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="search"
              placeholder="Ej. QR-LAP-0001"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-base sm:text-xs"
            />
            <button type="button" onClick={() => void findProduct(manualCode)} disabled={!manualCode.trim() || status === 'searching'} className="touch-manipulation select-none rounded-xl border border-highlight/65 bg-brand-soft px-4 text-xs font-bold text-brand active:scale-[.98] disabled:opacity-40">Buscar</button>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-slate-400">
          Con HTTPS se usa el escáner en vivo. En HTTP, la captura abre la cámara nativa y analiza la foto sin mantenerla almacenada.
        </p>
      </div>
    </Modal>
  );
}
