import { agentMethods, commentMethods, readMethods } from '../../../remote/src/models/Remote.types';
import type { RemoteNativeStatus } from '../models/Environment.types';

const reads: readonly string[] = [...readMethods, ...commentMethods];
const device: readonly string[] = [...reads, ...agentMethods];
const paired: RemoteNativeStatus['state'][] = ['connecting', 'online', 'offline'];
/** Recorded evidence is read only where a computer attached it: a grant alone never says so. */
const attachedOnly: readonly string[] = ['evidence', 'artifact'];
const unattached = (methods: readonly string[]) =>
	methods.filter((item) => !attachedOnly.includes(item));
const assumed = { reads: unattached(reads), device: unattached(device) };

/**
 * What a phone may ask of its computer right now. The methods the computer attached decide;
 * where a status carries none, its grant does, for all but recorded evidence. A phone that is
 * not paired is offered nothing, and no status can add an operation of the desktop itself.
 */
export function remoteGrant(status: RemoteNativeStatus | null): Set<string> {
	if (!status?.grant || !paired.includes(status.state)) return new Set();
	const attached = status.methods;
	if (Array.isArray(attached)) return new Set(attached.filter((item) => device.includes(item)));
	return new Set(status.grant.agents ? assumed.device : assumed.reads);
}
