

export /** What a tombstone keeps is the row and its generation. Every token is erased. */
const ERASE =
	"token_cipher = '', token_expires_at = NULL, refresh_cipher = NULL, refresh_expires_at = NULL, refreshing_until = NULL";

/** An expired grant becomes a tombstone. Rows are never deleted, so a generation never repeats. */
export const EXPIRE_GRANTS = `UPDATE auth_github_grants SET ${ERASE}, generation = generation + 1, revoked_at = expires_at WHERE expires_at <= ? AND revoked_at IS NULL`;

export { d1GrantStore } from '../adapters/d1-auth-store-adapter/d1GrantStore';
