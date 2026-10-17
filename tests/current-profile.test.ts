import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCurrentProfile } from '../lib/current-profile';

describe('getCurrentProfile', () => {
  const getUser = vi.fn();
  const getProfile = vi.fn();
  const supabase = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns no user or profile when authentication is unavailable', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await readCurrentProfile(supabase, getUser, getProfile);

    expect(result).toEqual({ supabase, user: null, profile: null });
    expect(getProfile).not.toHaveBeenCalled();
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
    getProfile.mockResolvedValue({ data: profile, error: null });

    const result = await readCurrentProfile(supabase, getUser, getProfile);

    expect(result).toEqual({ supabase, user, profile });
    expect(getProfile).toHaveBeenCalledWith(user.id);
  });

  it('propagates profile query failures', async () => {
    const queryError = new Error('profile query failed');
    getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
    getProfile.mockResolvedValue({ data: null, error: queryError });

    await expect(readCurrentProfile(supabase, getUser, getProfile)).rejects.toBe(queryError);
  });
});
