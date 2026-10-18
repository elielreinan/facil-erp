type RpcResult = {
  data: boolean | null;
  error: unknown | null;
};

export type OperationalAccess = 'ready' | 'password-rotation-required' | 'profile-inactive';

export async function checkOperationalAccess(
  getRotationRequired: () => PromiseLike<RpcResult>,
  getProfileActive: () => PromiseLike<RpcResult>,
): Promise<OperationalAccess> {
  const rotation = await getRotationRequired();
  if (rotation.error) throw rotation.error;
  if (typeof rotation.data !== 'boolean') {
    throw new Error('Estado de troca de senha inválido.');
  }
  if (rotation.data) return 'password-rotation-required';

  const profile = await getProfileActive();
  if (profile.error) throw profile.error;
  if (typeof profile.data !== 'boolean') {
    throw new Error('Estado do perfil operacional inválido.');
  }
  return profile.data ? 'ready' : 'profile-inactive';
}
