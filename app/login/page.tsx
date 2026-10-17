'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '../../lib/supabase';

type LoginMode = 'login' | 'recovery-request' | 'invite-code' | 'recovery-code';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [mode, setMode] = useState<LoginMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return;
    }

    const supabase = getSupabaseClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace('/dashboard');
      }
    });
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
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

      router.replace('/dashboard');
      router.refresh();
    } catch (error) {
      console.error('Falha ao realizar login:', error);
      setErrorMessage('Não foi possível realizar o login. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    setIsSubmitting(true);
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setStatusMessage('Se o e-mail estiver cadastrado, enviaremos um código. Confira a caixa de entrada e informe-o aqui.');
      setMode('recovery-code');
    } catch (error) {
      console.error('Falha ao solicitar redefinição de senha:', error);
      setErrorMessage('Não foi possível solicitar a redefinição. Tente novamente mais tarde.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode(
    event: FormEvent<HTMLFormElement>,
    type: 'invite' | 'recovery',
  ) {
    event.preventDefault();
    setErrorMessage('');
    setStatusMessage('');
    setIsSubmitting(true);
    try {
      const { error } = await getSupabaseClient().auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type,
      });
      if (error) {
        setErrorMessage('Código inválido ou expirado. Confira o código ou solicite outro.');
        return;
      }
      router.replace('/redefinir-senha');
      router.refresh();
    } catch (error) {
      console.error('Falha ao validar o código de acesso:', error);
      setErrorMessage('Não foi possível validar o código. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = mode === 'login'
    ? 'Acesse sua conta'
    : mode === 'recovery-request'
      ? 'Redefina sua senha'
      : mode === 'invite-code'
        ? 'Ative seu acesso'
        : 'Informe o código';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
            FACIL ERP
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === 'login'
              ? 'Entre com suas credenciais corporativas para continuar.'
              : mode === 'recovery-request'
                ? 'Informe seu e-mail para receber um código de redefinição.'
                : mode === 'invite-code'
                  ? 'Informe o e-mail e o código enviado pelo administrador para ativar sua conta.'
                  : 'Informe o código de 6 dígitos enviado para seu e-mail.'}
          </p>
        </div>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            if (mode === 'login') void handleLogin(event);
            else if (mode === 'recovery-request') void handleRecovery(event);
            else void handleVerifyCode(event, mode === 'invite-code' ? 'invite' : 'recovery');
          }}
        >
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

          {mode === 'login' && <div>
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
          </div>}

          {(mode === 'invite-code' || mode === 'recovery-code') && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="otp-code">
                Código de 6 dígitos
              </label>
              <input
                autoComplete="one-time-code"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                id="otp-code"
                inputMode="numeric"
                maxLength={6}
                minLength={6}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                pattern="[0-9]{6}"
                required
                value={otpCode}
              />
            </div>
          )}

          {statusMessage ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
              {statusMessage}
            </p>
          ) : null}
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
            {isSubmitting
              ? 'Aguarde...'
              : mode === 'login'
                ? 'Entrar'
                : mode === 'recovery-request'
                  ? 'Enviar código'
                  : 'Validar código'}
          </button>

          {mode === 'login' ? (
            <>
              <button
                className="w-full text-sm font-semibold text-blue-700 hover:text-blue-900"
                disabled={isSubmitting}
                onClick={() => {
                  setMode('recovery-request');
                  setErrorMessage('');
                  setStatusMessage('');
                }}
                type="button"
              >
                Esqueci minha senha
              </button>
              <button
                className="w-full text-sm font-semibold text-blue-700 hover:text-blue-900"
                disabled={isSubmitting}
                onClick={() => {
                  setMode('invite-code');
                  setErrorMessage('');
                  setStatusMessage('');
                }}
                type="button"
              >
                Ativar convite
              </button>
              <p className="text-center text-sm text-slate-500">Acesso restrito a usuários autorizados.</p>
            </>
          ) : (
            <button
              className="w-full text-sm font-semibold text-blue-700 hover:text-blue-900"
              disabled={isSubmitting}
              onClick={() => {
                setMode('login');
                setOtpCode('');
                setErrorMessage('');
                setStatusMessage('');
              }}
              type="button"
            >
              Voltar ao login
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
