// @harness-uid u_akeaixll3y
import type { ProfileEntry, ProfileGrant, GrantOfKind } from '../ExplorerPermissionsScreen.types';

export function profileGrants<K extends ProfileGrant['kind']>(
	profile: ProfileEntry,
	kind: K
): GrantOfKind<K>[] {
	return profile.grants.filter((grant): grant is GrantOfKind<K> => grant.kind === kind);
}
