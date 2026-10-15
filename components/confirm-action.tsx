'use client';

import { useState } from 'react';

type ConfirmActionProps = {
  actionLabel: string;
  description: string;
  onConfirm: () => void;
  children: React.ReactNode;
  disabled?: boolean;
};

export function ConfirmAction({ actionLabel, description, onConfirm, children, disabled = false }: ConfirmActionProps) {
  const [isOpen, setIsOpen] = useState(false);

  function confirm() {
    setIsOpen(false);
    onConfirm();
  }

  return (
    <>
      <span onClick={() => !disabled && setIsOpen(true)}>
        {children}
      </span>
      {isOpen && (
        <div aria-labelledby="confirm-title" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900" id="confirm-title">Confirmar ação</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={() => setIsOpen(false)} type="button">Cancelar</button>
              <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={confirm} type="button">{actionLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
