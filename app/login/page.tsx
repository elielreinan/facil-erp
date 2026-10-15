'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'As variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.',
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return;
    }

    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/dashboard');
      }
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage('E-mail ou senha inválidos.');
        return;
      }

      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      console.error('Falha ao realizar login:', error);
      setErrorMessage('Não foi possível realizar o login. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDemoLogin() {
    router.replace('/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
            PROJ PARA FACILITAS
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Acesse sua conta</h1>
          <p className="mt-2 text-sm text-slate-600">
            Entre com suas credenciais corporativas para continuar.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
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

          <button
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={handleDemoLogin}
            type="button"
          >
            Explorar em modo demonstração
          </button>
          <p className="text-center text-sm text-slate-500">
            Acesso administrado pelo sistema corporativo de TI.
          </p>
        </form>
      </section>
    </main>
  );
}
