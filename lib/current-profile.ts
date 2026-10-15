import { getSupabaseClient } from './supabase';

export async function getCurrentProfile() {
  const supabase = getSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { supabase, user: null, profile: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from('perfis')
    .select('id,nome,email,setor,nivel')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  return { supabase, user: authData.user, profile };
}
