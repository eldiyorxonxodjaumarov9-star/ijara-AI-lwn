import type { AccountSyncState } from "@/lib/cloud/account-state";
import type { AppUser } from "@/types";

/** Strip plaintext demo passwords before cloud sync read/write. */
export function sanitizeAccountSyncState(
  state: AccountSyncState
): AccountSyncState {
  const demoUsers = state.demoUsers.map((entry) => {
    const { password: _pw, ...safe } = entry;
    void _pw;
    return safe as AppUser;
  });
  return { ...state, demoUsers: demoUsers as AccountSyncState["demoUsers"] };
}
