import type { AuditProfile } from './adapters/types';
import { fail } from '../core/errors';

export function parseAuditProfile(profile: string): AuditProfile {
	if (profile === 'app' || profile === 'auto' || profile === 'lib') return profile;
	return fail(`Unsupported audit profile "${profile}". Use one of: auto, app, lib.`);
}
