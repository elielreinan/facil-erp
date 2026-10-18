import { describe, expect, it, vi } from 'vitest';
import { getAuthenticatedUser } from '../lib/authenticated-user';

describe('getAuthenticatedUser', () => {
  it('returns null without validating a token when there is no session', async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const getUser = vi.fn();

    await expect(getAuthenticatedUser(getSession, getUser)).resolves.toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it('validates the access token from the current session', async () => {
    const user = { id: 'user-123' };
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'session-token' } },
      error: null,
    });
    const getUser = vi.fn().mockResolvedValue({
      data: { user },
      error: null,
    });

    await expect(getAuthenticatedUser(getSession, getUser)).resolves.toEqual(user);
    expect(getUser).toHaveBeenCalledWith('session-token');
  });

  it('surfaces session and token validation errors', async () => {
    const sessionError = new Error('session read failed');
    const getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: sessionError });
    const getUser = vi.fn();

    await expect(getAuthenticatedUser(getSession, getUser)).rejects.toBe(sessionError);
    expect(getUser).not.toHaveBeenCalled();
  });
});
