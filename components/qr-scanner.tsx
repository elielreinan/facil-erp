'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type BarcodeDetectorResult = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

export function QrScanner({ onDetected, onClose }: {
  onDetected: (value: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('A câmera não está disponível neste ambiente. Use a entrada manual.');
        setIsStarting(false);
        return;
      }
      if (!window.BarcodeDetector) {
        setCameraError('A leitura automática não é compatível com este ambiente. Use a entrada manual.');
        setIsStarting(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStarting(false);
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const scan = async () => {
          if (!active || !videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const results = await detector.detect(videoRef.current);
            const value = results.find((result) => result.rawValue.trim())?.rawValue.trim();
            if (value) {
              onDetected(value);
              return;
            }
          } catch (error) {
            console.error('Falha ao ler QR Code:', error);
          }
          scanTimerRef.current = window.setTimeout(() => void scan(), 350);
        };
        void scan();
      } catch (error) {
        console.error('Falha ao iniciar câmera:', error);
        setCameraError('Não foi possível acessar a câmera. Verifique a permissão ou use a entrada manual.');
        setIsStarting(false);
      }
    }

    void startCamera();
    return () => {
      active = false;
      if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [onDetected]);

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = manualValue.trim();
    if (value) onDetected(value);
  }

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold" id="qr-scanner-title">Ler etiqueta de patrimônio</h3>
          <p className="mt-1 text-sm text-slate-600">A leitura não salva alterações automaticamente.</p>
        </div>
        <button className="rounded px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-white" onClick={onClose} type="button">Fechar</button>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg bg-slate-900">
        <video aria-label="Pré-visualização da câmera para leitura do QR Code" className="aspect-video w-full object-cover" muted playsInline ref={videoRef} />
      </div>
      {isStarting && <p className="mt-3 text-sm text-slate-600">Solicitando acesso à câmera...</p>}
      {cameraError && <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">{cameraError}</p>}
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={handleManualSubmit}>
        <label className="sr-only" htmlFor="manual-qr-value">Conteúdo da etiqueta</label>
        <input className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm" id="manual-qr-value" onChange={(event) => setManualValue(event.target.value)} placeholder="Digite ou cole o conteúdo da etiqueta" value={manualValue} />
        <button className="rounded bg-slate-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!manualValue.trim()} type="submit">Usar leitura</button>
      </form>
    </div>
  );
}
