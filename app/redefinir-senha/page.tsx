'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../../lib/supabase';
import { isStrongPassword } from '../../lib/validation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = getSupabaseClient();
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      setSessionReady(!error && Boolean(data.user));
    }).catch((error: unknown) => {
      console.error('Falha ao validar o link de redefinição:', error);
      if (active) setSessionReady(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    if (!isStrongPassword(password)) {
      setErrorMessage('Use de 12 a 128 caracteres, com minúscula, maiúscula, número e símbolo.');
      return;
    }
    if (password !== confirmation) {
      setErrorMessage('As senhas informadas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password });
      if (error) {
        console.error('Falha ao atualizar a senha:', error);
        setErrorMessage('Não foi possível atualizar a senha. Solicite um novo link.');
        return;
      }
      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      console.error('Falha ao concluir a redefinição de senha:', error);
      setErrorMessage('Não foi possível atualizar a senha. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
          FACIL ERP
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">Defina sua senha</h1>
        {sessionReady === null ? (
          <p className="mt-4 text-sm text-slate-600" role="status">
            Validando o link de convite ou recuperação...
          </p>
        ) : sessionReady ? (
          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">
                Nova senha
              </label>
              <p className="mb-2 text-xs text-slate-500">12–128 caracteres, incluindo minúscula, maiúscula, número e símbolo.</p>
              <input
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                id="password"
                maxLength={128}
                minLength={12}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="confirmation">
                Confirme a nova senha
              </label>
              <input
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                id="confirmation"
                maxLength={128}
                minLength={12}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                type="password"
                value={confirmation}
              />
            </div>
            {errorMessage && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {errorMessage}
              </p>
            )}
            <button
              className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar senha'}
            </button>
          </form>
        ) : null}
        {sessionReady === false && (
          <p className="mt-4 text-sm text-slate-600">
            O link é inválido ou expirou. Solicite um novo ao administrador.
          </p>
        )}
      </section>
    </main>
  );
}
