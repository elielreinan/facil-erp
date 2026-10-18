type SessionResult = {
  data: { session: { access_token: string } | null };
  error: unknown | null;
};

type UserResult<TUser> = {
  data: { user: TUser | null };
  error: unknown | null;
};

export async function getAuthenticatedUser<TUser>(
  getSession: () => PromiseLike<SessionResult>,
  getUser: (accessToken: string) => PromiseLike<UserResult<TUser>>,
): Promise<TUser | null> {
  const sessionResult = await getSession();
  if (sessionResult.error) throw sessionResult.error;
  if (!sessionResult.data.session) return null;

  const userResult = await getUser(sessionResult.data.session.access_token);
  if (userResult.error) throw userResult.error;
  return userResult.data.user;
}
