import { describe, expect, it, vi } from 'vitest';
import { checkOperationalAccess } from '../lib/operational-access';

describe('checkOperationalAccess', () => {
  it('requires temporary password rotation before checking the profile', async () => {
    const getRotationRequired = vi.fn().mockResolvedValue({ data: true, error: null });
    const getProfileActive = vi.fn();

    await expect(checkOperationalAccess(getRotationRequired, getProfileActive))
      .resolves.toBe('password-rotation-required');
    expect(getProfileActive).not.toHaveBeenCalled();
  });

  it('blocks authenticated users without an active operational profile', async () => {
    const getRotationRequired = vi.fn().mockResolvedValue({ data: false, error: null });
    const getProfileActive = vi.fn().mockResolvedValue({ data: false, error: null });

    await expect(checkOperationalAccess(getRotationRequired, getProfileActive))
      .resolves.toBe('profile-inactive');
  });

  it('allows users with an active profile and no required password rotation', async () => {
    const getRotationRequired = vi.fn().mockResolvedValue({ data: false, error: null });
    const getProfileActive = vi.fn().mockResolvedValue({ data: true, error: null });

    await expect(checkOperationalAccess(getRotationRequired, getProfileActive))
      .resolves.toBe('ready');
  });

  it('surfaces RPC failures instead of allowing access', async () => {
    const rpcError = new Error('profile check failed');
    const getRotationRequired = vi.fn().mockResolvedValue({ data: false, error: null });
    const getProfileActive = vi.fn().mockResolvedValue({ data: null, error: rpcError });

    await expect(checkOperationalAccess(getRotationRequired, getProfileActive))
      .rejects.toBe(rpcError);
  });
});
