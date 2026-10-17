'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';

export function QrScanner({ onDetected, onClose, title = 'Ler código QR', description = 'A leitura não salva alterações automaticamente.' }: {
  onDetected: (value: string) => void;
  onClose: () => void;
  title?: string;
  description?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [isStarting, setIsStarting] = useState(true);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      if (!window.isSecureContext) {
        setCameraError('A câmera exige uma conexão HTTPS segura. Abra o sistema pelo endereço publicado ou use a entrada manual.');
        setIsStarting(false);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('A câmera não está disponível neste ambiente. Use a entrada manual.');
        setIsStarting(false);
        return;
      }

      try {
        if (!videoRef.current) return;
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 1000,
        });
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: { facingMode: { ideal: 'environment' } },
          },
          videoRef.current,
          (result) => {
            const value = result?.getText().trim();
            if (!active || !value) return;
            active = false;
            controlsRef.current?.stop();
            onDetectedRef.current(value);
          },
        );
        if (!active) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setIsStarting(false);
      } catch (error) {
        console.error('Falha ao iniciar câmera:', error);
        setCameraError('Não foi possível acessar a câmera. Verifique a permissão ou use a entrada manual.');
        setIsStarting(false);
      }
    }

    void startCamera();
    return () => {
      active = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, []);

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = manualValue.trim();
    if (value) onDetected(value);
  }

  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold" id="qr-scanner-title">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <button className="rounded px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-white" onClick={onClose} type="button">Fechar</button>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg bg-slate-900">
        <video aria-label="Pré-visualização da câmera para leitura do QR Code" className="aspect-video w-full object-cover" muted playsInline ref={videoRef} />
      </div>
      <p className="mt-2 text-xs text-slate-500">Em celulares, a leitura usa a câmera traseira quando disponível e exige acesso pelo endereço HTTPS do sistema.</p>
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
