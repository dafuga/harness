import type { RemoteMobileStatus } from '../../models/development-tooling/Environment.types';

/** Under whose identity and which grant what is on a page was read. */
export interface Authority {
	holder: string | null;
	grant: string;
}
export const noAuthority: Authority = { holder: null, grant: '' };

/** Whose data may be shown: this computer and this phone, with exactly this grant. */
export function remoteAuthority(status: RemoteMobileStatus): Authority {
	const holder = `${status.host?.id ?? ''}/${status.device?.id ?? ''}`;
	return { holder, grant: JSON.stringify(status.grant) };
}

/**
 * What differs from the authority the page's content was read under. Another computer or
 * another phone ends every view; anything else, also coming back online, is read anew.
 */
export function authorityChange(known: Authority, next: Authority, steady: boolean) {
	const same = next.holder === known.holder && next.grant === known.grant;
	if (steady && same) return 'none';
	return known.holder !== null && next.holder !== known.holder ? 'holder' : 'grant';
}

/** Whether a shown project is outside what the status grants. */
export function excludes(status: RemoteMobileStatus, projectId: string | null): boolean {
	return projectId !== null && !status.grant?.projects.some((item) => item.id === projectId);
}
