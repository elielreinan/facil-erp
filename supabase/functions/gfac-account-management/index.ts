import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { sha256Hex, verifyM2MToken, type M2MClaims } from '../_shared/m2m.ts';

const EXPECTED_ISSUER = 'gfacilerp:jqjvzypalurnhbkqlzpx';
const EXPECTED_AUDIENCE = 'facil-erp-account-management';
const EXPECTED_SCOPE = 'managed-users:write';
const ALLOWED_SECTORS = new Set(['suprimentos', 'orcamentos', 'ti', 'diretoria']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestPayload =
  | { action: 'invite'; managed_user_id: string; nome: string; email: string; setor: string }
  | { action: 'reset'; managed_user_id: string; auth_user_id: string; email: string }
  | { action: 'set_status'; managed_user_id: string; auth_user_id: string; status: 'aprovado' | 'bloqueado' }
  | { action: 'set_sector'; managed_user_id: string; auth_user_id: string; setor: string };

type IdentityLink = { managed_user_id: string; auth_user_id: string; email: string };
type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};
type Database = {
  public: {
    Tables: {
      perfis: Table<
        {
          id: string;
          nome: string;
          email: string;
          setor: string;
          nivel: string;
          ativo: boolean;
        },
        {
          id: string;
          nome: string;
          email: string;
          setor: string;
          nivel: string;
          ativo: boolean;
        }
      >;
      gfac_user_links: Table<
        {
          managed_user_id: string;
          auth_user_id: string;
          email: string;
          criado_em: string;
        },
        {
          managed_user_id: string;
          auth_user_id: string;
          email: string;
          criado_em?: string;
        }
      >;
      gfac_m2m_nonces: Table<
        { jti: string; expires_at: string; criado_em: string },
        { jti: string; expires_at: string; criado_em?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
type ServiceClient = SupabaseClient<Database, 'public'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function getEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

function parseRequest(value: unknown): RequestPayload | null {
  if (!isRecord(value) || !isUuid(value.managed_user_id) || typeof value.action !== 'string') return null;

  if (value.action === 'invite') {
    if (
      typeof value.nome !== 'string' ||
      value.nome.trim().length < 2 ||
      value.nome.trim().length > 150 ||
      typeof value.email !== 'string' ||
      value.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()) ||
      typeof value.setor !== 'string' ||
      !ALLOWED_SECTORS.has(value.setor)
    ) return null;
    return {
      action: 'invite',
      managed_user_id: value.managed_user_id,
      nome: value.nome.trim(),
      email: value.email.trim().toLowerCase(),
      setor: value.setor,
    };
  }

  if (!isUuid(value.auth_user_id)) return null;
  if (value.action === 'reset') {
    if (
      typeof value.email !== 'string' ||
      value.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())
    ) return null;
    return {
      action: 'reset',
      managed_user_id: value.managed_user_id,
      auth_user_id: value.auth_user_id,
      email: value.email.trim().toLowerCase(),
    };
  }
  if (value.action === 'set_status') {
    if (value.status !== 'aprovado' && value.status !== 'bloqueado') return null;
    return {
      action: 'set_status',
      managed_user_id: value.managed_user_id,
      auth_user_id: value.auth_user_id,
      status: value.status,
    };
  }
  if (value.action === 'set_sector') {
    if (typeof value.setor !== 'string' || !ALLOWED_SECTORS.has(value.setor)) return null;
    return {
      action: 'set_sector',
      managed_user_id: value.managed_user_id,
      auth_user_id: value.auth_user_id,
      setor: value.setor,
    };
  }
  return null;
}

function validateClaims(claims: M2MClaims, bodyHash: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  return claims.iss === EXPECTED_ISSUER &&
    claims.aud === EXPECTED_AUDIENCE &&
    claims.scope === EXPECTED_SCOPE &&
    isUuid(claims.sub) &&
    isUuid(claims.jti) &&
    claims.exp > now &&
    claims.exp > claims.iat &&
    claims.exp <= now + 45 &&
    claims.exp - claims.iat <= 45 &&
    claims.iat <= now + 5 &&
    claims.iat >= now - 60 &&
    claims.body_sha256 === bodyHash;
}

async function getIdentityLink(
  client: ServiceClient,
  managedUserId: string,
): Promise<IdentityLink | null> {
  const { data, error } = await client
    .from('gfac_user_links')
    .select('managed_user_id,auth_user_id,email')
    .eq('managed_user_id', managedUserId)
    .maybeSingle();
  if (error) {
    console.error('Failed to resolve GFacilERP identity link.', { code: error.code });
    throw new Error('Identity lookup failed.');
  }
  return data as IdentityLink | null;
}

async function requireIdentityLink(
  client: ServiceClient,
  managedUserId: string,
  authUserId: string,
): Promise<IdentityLink> {
  const link = await getIdentityLink(client, managedUserId);
  if (!link || link.auth_user_id !== authUserId) throw new Error('Identity link mismatch.');
  return link;
}

async function applyOperation(
  client: ServiceClient,
  payload: RequestPayload,
): Promise<Record<string, unknown>> {
  if (payload.action === 'invite') {
    const existingLink = await getIdentityLink(client, payload.managed_user_id);
    if (existingLink) {
      if (existingLink.email.toLowerCase() !== payload.email) {
        throw new Error('Managed user email does not match the existing identity.');
      }
      return { auth_user_id: existingLink.auth_user_id };
    }

    const { data: inviteData, error: inviteError } = await client.auth.admin.inviteUserByEmail(
      payload.email,
      { data: { nome: payload.nome, setor: payload.setor } },
    );
    if (inviteError || !inviteData.user) {
      console.error('Failed to invite the FacilERP account.', { code: inviteError?.name });
      throw new Error('Auth invitation failed.');
    }

    const authUserId = inviteData.user.id;
    try {
      const { error: profileError } = await client.from('perfis').insert({
        id: authUserId,
        nome: payload.nome,
        email: payload.email,
        setor: payload.setor,
        nivel: 'NV1',
        ativo: false,
      });
      if (profileError) {
        console.error('Failed to create the invited FacilERP profile.', { code: profileError.code });
        throw new Error('Profile creation failed.');
      }
      const { error: linkError } = await client.from('gfac_user_links').insert({
        managed_user_id: payload.managed_user_id,
        auth_user_id: authUserId,
        email: payload.email,
      });
      if (linkError) {
        console.error('Failed to link the invited FacilERP identity.', { code: linkError.code });
        throw new Error('Identity link creation failed.');
      }
    } catch (error) {
      const { error: rollbackError } = await client.auth.admin.deleteUser(authUserId);
      if (rollbackError) {
        console.error('Failed to roll back an incomplete invitation.', {
          code: rollbackError.name,
        });
        throw new Error('Invitation reconciliation is required.');
      }
      throw error;
    }
    return { auth_user_id: authUserId };
  }

  if (payload.action === 'reset') {
    const link = await requireIdentityLink(client, payload.managed_user_id, payload.auth_user_id);
    if (link.email.toLowerCase() !== payload.email) throw new Error('Identity email mismatch.');
    const { error } = await client.auth.resetPasswordForEmail(payload.email);
    if (error) {
      console.error('Failed to send a FacilERP password-reset code.', { code: error.name });
      throw new Error('Password-reset email failed.');
    }
    return { auth_user_id: payload.auth_user_id };
  }

  const link = await requireIdentityLink(client, payload.managed_user_id, payload.auth_user_id);
  if (payload.action === 'set_status') {
    const active = payload.status === 'aprovado';
    if (active) {
      const { error: authError } = await client.auth.admin.updateUserById(link.auth_user_id, {
        ban_duration: 'none',
      });
      if (authError) {
        console.error('Failed to unban the FacilERP Auth account.', { code: authError.name });
        throw new Error('Auth status update failed.');
      }
    }
    const { data: profile, error: profileError } = await client
      .from('perfis')
      .update({ ativo: active })
      .eq('id', link.auth_user_id)
      .select('id')
      .maybeSingle();
    if (profileError || !profile) {
      console.error('Failed to update FacilERP profile status.', { code: profileError?.code });
      throw new Error('Profile status update failed.');
    }
    if (!active) {
      const { error: authError } = await client.auth.admin.updateUserById(link.auth_user_id, {
        ban_duration: '876000h',
      });
      if (authError) {
        console.error('Failed to ban the FacilERP Auth account.', { code: authError.name });
        throw new Error('Profile was disabled but Auth ban needs reconciliation.');
      }
    }
    return { auth_user_id: link.auth_user_id, status: payload.status };
  }

  if (payload.action === 'set_sector') {
    const { data: profile, error } = await client
      .from('perfis')
      .update({ setor: payload.setor })
      .eq('id', link.auth_user_id)
      .select('id')
      .maybeSingle();
    if (error || !profile) {
      console.error('Failed to update FacilERP profile sector.', { code: error?.code });
      throw new Error('Profile sector update failed.');
    }
    return { auth_user_id: link.auth_user_id, setor: payload.setor };
  }

  throw new Error('Unsupported account management operation.');
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST' || request.headers.has('origin')) {
    return jsonResponse(403, { error: 'forbidden' });
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return jsonResponse(415, { error: 'unsupported_media_type' });
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 8_192) return jsonResponse(413, { error: 'request_too_large' });

  try {
    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    const publicKey = getEnv('GFA_CROSS_PROJECT_PUBLIC_KEY_B64');
    if (!token) return jsonResponse(401, { error: 'unauthorized' });

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > 8_192) {
      return jsonResponse(413, { error: 'request_too_large' });
    }
    const claims = await verifyM2MToken(token, publicKey);
    if (!claims) return jsonResponse(401, { error: 'unauthorized' });
    const bodyHash = await sha256Hex(rawBody);
    if (!validateClaims(claims, bodyHash)) return jsonResponse(401, { error: 'unauthorized' });

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return jsonResponse(400, { error: 'invalid_request' });
    }
    const payload = parseRequest(parsed);
    if (!payload) return jsonResponse(400, { error: 'invalid_request' });

    const supabaseUrl = getEnv('SUPABASE_URL');
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
    const client = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const now = new Date();
    const { error: cleanupError } = await client
      .from('gfac_m2m_nonces')
      .delete()
      .lt('expires_at', now.toISOString());
    if (cleanupError) {
      console.error('Failed to clean expired M2M nonces.', { code: cleanupError.code });
      return jsonResponse(503, { error: 'replay_protection_unavailable' });
    }
    const { error: nonceError } = await client.from('gfac_m2m_nonces').insert({
      jti: claims.jti,
      expires_at: new Date(claims.exp * 1000).toISOString(),
    });
    if (nonceError) {
      if (nonceError.code === '23505') return jsonResponse(409, { error: 'request_replayed' });
      console.error('Failed to persist M2M nonce.', { code: nonceError.code });
      return jsonResponse(503, { error: 'replay_protection_unavailable' });
    }

    const result = await applyOperation(client, payload);
    return jsonResponse(200, result);
  } catch (error) {
    console.error('FacilERP account-management request failed.', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return jsonResponse(500, { error: 'account_management_failed' });
  }
});
