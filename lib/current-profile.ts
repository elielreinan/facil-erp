import { getSupabaseClient } from './supabase';
import { getAuthenticatedUser } from './authenticated-user';

type Profile = {
  id: string;
  nome: string;
  email: string;
  setor: string;
  nivel: string;
};

export async function readCurrentProfile<
  TClient,
  TUser extends { id: string },
>(
  supabase: TClient,
  getUser: () => PromiseLike<{
    data: { user: TUser | null };
    error: unknown | null;
  }>,
  getProfile: (userId: string) => PromiseLike<{
    data: Profile | null;
    error: unknown | null;
  }>,
) {
  const { data: authData, error: authError } = await getUser();
  if (authError || !authData.user) {
    return { supabase, user: null, profile: null };
  }

  const { data: profile, error: profileError } = await getProfile(authData.user.id);
  if (profileError) throw profileError;
  return { supabase, user: authData.user, profile };
}

export function getCurrentProfile() {
  const supabase = getSupabaseClient();
  return readCurrentProfile(
    supabase,
    () => getAuthenticatedUser(
      () => supabase.auth.getSession(),
      (accessToken) => supabase.auth.getUser(accessToken),
    ).then((user) => ({ data: { user }, error: null })),
    (userId) => supabase
      .from('perfis')
      .select('id,nome,email,setor,nivel')
      .eq('id', userId)
      .maybeSingle(),
  );
}
