// @harness-uid u_fuqy4vxmvv
import {
	agentMethods,
	commentMethods,
	readMethods
} from '../../../../../../remote/src/models/Remote.types';
import type { RemoteNativeStatus } from '../../../../models/development-tooling/Environment.types';

const reads: readonly string[] = [...readMethods, ...commentMethods];

const device: readonly string[] = [...reads, ...agentMethods, 'homeSnapshot'];

const paired: RemoteNativeStatus['state'][] = ['connecting', 'online', 'offline'];

/** Recorded evidence and Home data require the computer to advertise the methods explicitly. */
const attachedOnly: readonly string[] = ['evidence', 'artifact', 'homeSnapshot'];

const unattached = (methods: readonly string[]) =>
	methods.filter((item) => !attachedOnly.includes(item));

const assumed = { reads: unattached(reads), device: unattached(device) };

/**
 * What a phone may ask of its computer right now. The methods the computer attached decide;
 * where a status carries none, its grant offers the base project methods. A phone that is
 * not paired is offered nothing, and no status can add an operation of the desktop itself.
 */
export function remoteGrant(status: RemoteNativeStatus | null): Set<string> {
	if (!status?.grant || !paired.includes(status.state)) return new Set();
	const attached = status.methods;
	if (Array.isArray(attached)) return new Set(attached.filter((item) => device.includes(item)));
	const methods = status.grant.agents ? assumed.device : assumed.reads;
	return new Set(
		status.grant.comments === false
			? methods.filter((method) => !(commentMethods as readonly string[]).includes(method))
			: methods
	);
}
