import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseClient } from '../lib/supabase';
import { getCurrentProfile } from '../lib/current-profile';

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: vi.fn(),
}));

describe('getCurrentProfile', () => {
  const getUser = vi.fn();
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const supabase = { auth: { getUser }, from } as ReturnType<typeof getSupabaseClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabaseClient).mockReturnValue(supabase);
  });

  it('returns no user or profile when authentication is unavailable', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getCurrentProfile();

    expect(result).toEqual({ supabase, user: null, profile: null });
    expect(from).not.toHaveBeenCalled();
  });

  it('loads the authenticated user profile', async () => {
    const user = { id: 'user-123' };
    const profile = {
      id: user.id,
      nome: 'Usuário de teste',
      email: 'teste@example.invalid',
      setor: 'ti',
      nivel: 'NV1',
    };
    getUser.mockResolvedValue({ data: { user }, error: null });
    maybeSingle.mockResolvedValue({ data: profile, error: null });

    const result = await getCurrentProfile();

    expect(result).toEqual({ supabase, user, profile });
    expect(from).toHaveBeenCalledWith('perfis');
    expect(select).toHaveBeenCalledWith('id,nome,email,setor,nivel');
    expect(eq).toHaveBeenCalledWith('id', user.id);
  });

  it('propagates profile query failures', async () => {
    const queryError = new Error('profile query failed');
    getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    maybeSingle.mockResolvedValue({ data: null, error: queryError });

    await expect(getCurrentProfile()).rejects.toBe(queryError);
  });
});
