'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthenticatedUser } from '../../lib/authenticated-user';
import { checkOperationalAccess } from '../../lib/operational-access';
import { getSupabaseClient } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }

    let active = true;
    void (async () => {
      try {
        const supabase = getSupabaseClient();
        const user = await getAuthenticatedUser(
          () => supabase.auth.getSession(),
          (accessToken) => supabase.auth.getUser(accessToken),
        );
        if (!user) return;
        if (active) setHasSession(true);

        const access = await checkOperationalAccess(
          () => supabase.rpc('needs_password_rotation'),
          () => supabase.rpc('is_profile_active'),
        );
        if (!active) return;
        if (access === 'profile-inactive') {
          setErrorMessage('Esta conta não tem um perfil operacional ativo. Peça ao administrador para verificar o cadastro e o status.');
          return;
        }
        router.replace(access === 'password-rotation-required' ? '/redefinir-senha' : '/dashboard');
      } catch (error: unknown) {
        console.error('Falha ao validar a sessão existente:', error);
        if (active) {
          setErrorMessage('Não foi possível validar a sessão. Tente novamente.');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage('E-mail ou senha inválidos.');
        return;
      }

      setHasSession(true);
      const access = await checkOperationalAccess(
        () => supabase.rpc('needs_password_rotation'),
        () => supabase.rpc('is_profile_active'),
      );
      if (access === 'profile-inactive') {
        setErrorMessage('A autenticação foi aceita, mas esta conta não tem um perfil operacional ativo. Peça ao administrador para verificar o cadastro e o status.');
        return;
      }
      router.replace(access === 'password-rotation-required' ? '/redefinir-senha' : '/dashboard');
      router.refresh();
    } catch (error: unknown) {
      console.error('Falha ao realizar login:', error);
      setErrorMessage('Não foi possível validar o acesso. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setErrorMessage('');
    try {
      const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
      if (error) throw error;
      setHasSession(false);
    } catch (error: unknown) {
      console.error('Falha ao encerrar a sessão no login:', error);
      setErrorMessage('Não foi possível encerrar a sessão. Tente novamente.');
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
            FACIL ERP
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Acesse sua conta</h1>
          <p className="mt-2 text-sm text-slate-600">
            Entre com suas credenciais corporativas para continuar.
          </p>
        </div>

        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="email">
              E-mail
            </label>
            <input
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="email"
              maxLength={254}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">
              Senha
            </label>
            <input
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              id="password"
              maxLength={128}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {hasSession ? (
            <button
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSigningOut}
              onClick={() => void handleSignOut()}
              type="button"
            >
              {isSigningOut ? 'Saindo...' : 'Sair desta conta'}
            </button>
          ) : null}

          <button
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Aguarde...' : 'Entrar'}
          </button>

          <p className="text-center text-sm text-slate-500">Convites e redefinição de senha estão indisponíveis até a configuração de SMTP no Supabase. Contate o administrador do sistema.</p>
        </form>
      </section>
    </main>
  );
}
