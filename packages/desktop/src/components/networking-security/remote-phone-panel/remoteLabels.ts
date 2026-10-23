import type { Words } from './remoteLabels.types';
import {
	grantLabel,
	awakeNote,
	lockedNote,
	unlockedNote,
	approveNote,
	awayNote,
	revokedNote
} from '../../../utils/networking-security/remoteLabels';
import { plural } from '../../../helpers/strings/plural';
import type {
	RemoteMobileStatus,
	RemoteNativeStatus
} from '../../../models/development-tooling/Environment.types';

export function grantSummary(grant: { projects: unknown[]; agents: boolean }): string {
	return `${plural(grant.projects.length, 'project')} · ${grantLabel(grant)}`;
}

/** The lock state is stated only when the computer reported one; otherwise only that it is awake. */
function awake(status: RemoteNativeStatus): string {
	if (typeof status.locked !== 'boolean') return awakeNote;
	return status.locked ? lockedNote : unlockedNote;
}

const words: Record<RemoteMobileStatus['state'], Words> = {
	unpaired: () => ({ title: 'Connect to computer', detail: '' }),
	pairing: () => ({ title: 'Contacting the relay…', detail: '' }),
	'pending-approval': (host) => ({
		title: `Waiting for approval on ${host}…`,
		detail: approveNote
	}),
	connecting: (host) => ({ title: `Connecting to ${host}…`, detail: '' }),
	online: (host, status) => ({ title: `Connected to ${host}`, detail: awake(status) }),
	offline: (_host, status) => ({ title: 'Computer offline', detail: status.reason || awayNote }),
	revoked: () => ({
		title: 'This phone’s access was removed on the computer.',
		detail: revokedNote
	})
};

/** What a phone says about its computer. Only an online computer is called connected. */
export function remoteLabels(status: RemoteNativeStatus): { title: string; detail: string } {
	return words[status.state](status.host?.name || 'your computer', status);
}
