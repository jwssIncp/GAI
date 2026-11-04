import type { CurrentUser } from "@/types/api";

export function loginDestination(
  user: CurrentUser,
  previousPath?: string,
): string {
  if (user.must_change_password) return "/app/change-password";
  // A revoked temporary session can have left this route as the login return path.
  if (
    !previousPath?.startsWith("/app/") ||
    /^\/app\/change-password(?:[/?#]|$)/.test(previousPath)
  )
    return "/app/dashboard";
  return previousPath;
}
