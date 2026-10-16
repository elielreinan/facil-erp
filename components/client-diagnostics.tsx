'use client';

import { useEffect } from 'react';
import { recordClientError } from '../lib/client-error-log';

export function ClientDiagnostics() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      recordClientError('ERROR', event.error instanceof Error ? event.error.message : 'Erro inesperado no aplicativo.');
    };
    const handleRejection = () => recordClientError('ERROR', 'Falha inesperada em uma operação assíncrona.');
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
  return null;
}
