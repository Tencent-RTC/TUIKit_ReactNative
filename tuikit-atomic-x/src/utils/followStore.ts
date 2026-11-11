// Temporary in-memory store until a follow API is available; lost on app restart.
const followedSet = new Set<string>();

export function isUserFollowed(userID: string | null | undefined): boolean {
  if (!userID) return false;
  return followedSet.has(userID);
}

export function setUserFollowed(
  userID: string | null | undefined,
  followed: boolean
): void {
  if (!userID) return;
  if (followed) followedSet.add(userID);
  else followedSet.delete(userID);
}

export function toggleUserFollowed(userID: string | null | undefined): boolean {
  if (!userID) return false;
  const next = !isUserFollowed(userID);
  setUserFollowed(userID, next);
  return next;
}
