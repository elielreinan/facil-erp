'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';

type LabelAsset = {
  id: string;
  nome_item: string;
  tipo: string;
  numero_serie: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] ?? character));
}

export function AssetLabel({ asset, onClose }: { asset: LabelAsset; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const payload = `facilerp://patrimonio/${asset.id}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 220 })
      .then((dataUrl) => { if (active) setQrDataUrl(dataUrl); })
      .catch((caughtError: unknown) => {
        console.error('Falha ao gerar etiqueta QR:', caughtError);
        if (active) setError('Não foi possível gerar o QR Code da etiqueta.');
      });
    return () => { active = false; };
  }, [payload]);

  function printLabel() {
    if (!qrDataUrl) return;
    const printWindow = window.open('', '_blank', 'width=480,height=640');
    if (!printWindow) {
      setError('Permita janelas pop-up para imprimir a etiqueta.');
      return;
    }
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiqueta ${escapeHtml(asset.nome_item)}</title><style>body{font-family:Arial,sans-serif;margin:0;padding:24px;text-align:center}img{display:block;margin:16px auto;width:220px;height:220px}h1{font-size:20px;margin:0 0 8px}p{font-size:13px;margin:5px 0;word-break:break-word}.code{color:#475569;font-family:monospace;font-size:10px}</style></head><body><h1>${escapeHtml(asset.nome_item)}</h1><p>${escapeHtml(asset.tipo)}</p><img alt="QR Code do patrimônio" src="${qrDataUrl}"><p>Número de série: ${escapeHtml(asset.numero_serie)}</p><p class="code">${escapeHtml(payload)}</p><script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}</script></body></html>`);
    printWindow.document.close();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="asset-label-title">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="font-bold" id="asset-label-title">Etiqueta de patrimônio</h2><p className="mt-1 text-sm text-slate-500">O QR Code usa somente o identificador do ativo.</p></div>
          <button className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onClose} type="button">Fechar</button>
        </div>
        <div className="mt-5 rounded border border-dashed border-slate-300 p-4 text-center">
          {qrDataUrl ? <Image alt={`QR Code de ${asset.nome_item}`} className="mx-auto h-48 w-48" height={192} src={qrDataUrl} unoptimized width={192} /> : <div className="flex h-48 items-center justify-center text-sm text-slate-500">Gerando QR Code...</div>}
          <p className="font-bold">{asset.nome_item}</p>
          <p className="text-sm text-slate-600">{asset.tipo}</p>
          <p className="mt-1 text-xs text-slate-500">Série: {asset.numero_serie}</p>
        </div>
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        <button className="mt-5 w-full rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!qrDataUrl} onClick={printLabel} type="button">Imprimir etiqueta</button>
      </div>
    </div>
  );
}
