import { createClient } from 'npm:@supabase/supabase-js@2';
import { isStrongPassword } from '../../../lib/validation.ts';

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://tauri.localhost',
]);

type JsonObject = Record<string, unknown>;

function corsHeaders(request: Request): Record<string, string> | null {
  const origin = request.headers.get('origin');
  if (!origin) return {};
  if (!allowedOrigins.has(origin)) return null;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, x-client-info, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

function jsonResponse(
  status: number,
  body: JsonObject,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

Deno.serve(async (request: Request) => {
  const headers = corsHeaders(request);
  if (!headers) return jsonResponse(403, { error: 'origin_not_allowed' });
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' }, headers);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse(415, { error: 'unsupported_media_type' }, headers);
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 4_096) return jsonResponse(413, { error: 'request_too_large' }, headers);

  try {
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return jsonResponse(401, { error: 'unauthorized' }, headers);

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > 4_096) {
      return jsonResponse(413, { error: 'request_too_large' }, headers);
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse(400, { error: 'invalid_request' }, headers);
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      Array.isArray(body) ||
      !('current_password' in body) ||
      typeof body.current_password !== 'string' ||
      body.current_password.length === 0 ||
      body.current_password.length > 128 ||
      !('password' in body) ||
      typeof body.password !== 'string' ||
      !isStrongPassword(body.password)
    ) {
      return jsonResponse(400, { error: 'invalid_request' }, headers);
    }
    const currentPassword = body.current_password;
    const newPassword = body.password;
    if (currentPassword === newPassword) {
      return jsonResponse(400, { error: 'password_must_change' }, headers);
    }

    const supabaseUrl = getEnv('SUPABASE_URL');
    const anonKey = getEnv('SUPABASE_ANON_KEY');
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    const user = authData.user;
    if (authError || !user?.email) return jsonResponse(401, { error: 'unauthorized' }, headers);

    const adminClient = createClient(supabaseUrl, getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile, error: profileError } = await adminClient
      .from('perfis')
      .select('ativo,must_change_password')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) {
      console.error('Failed to validate temporary-password profile.', { code: profileError.code });
      return jsonResponse(503, { error: 'profile_validation_unavailable' }, headers);
    }
    if (!profile?.ativo) return jsonResponse(403, { error: 'profile_inactive' }, headers);
    if (!profile.must_change_password) return jsonResponse(409, { error: 'password_rotation_not_required' }, headers);

    const passwordClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: currentPasswordError } = await passwordClient.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (currentPasswordError) return jsonResponse(401, { error: 'invalid_current_password' }, headers);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    if (updateError) {
      console.error('Failed to update temporary account password.', { code: updateError.name });
      return jsonResponse(400, { error: 'password_update_failed' }, headers);
    }

    const { data: updatedProfile, error: flagError } = await adminClient
      .from('perfis')
      .update({ must_change_password: false })
      .eq('id', user.id)
      .eq('ativo', true)
      .eq('must_change_password', true)
      .select('id')
      .maybeSingle();
    if (flagError || !updatedProfile) {
      console.error('Failed to clear temporary-password requirement.', { code: flagError?.code });
      return jsonResponse(503, { error: 'password_rotation_reconciliation_required' }, headers);
    }

    return jsonResponse(200, { ok: true }, headers);
  } catch (error) {
    console.error('Temporary-password rotation failed.', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return jsonResponse(500, { error: 'password_rotation_failed' }, headers);
  }
});
