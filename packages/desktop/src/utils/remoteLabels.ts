import type {
	RemoteHostStatus,
	RemoteMobileStatus,
	RemoteNativeStatus
} from '../models/Environment.types';

export const lockNote =
	'Approved phones keep working while this Mac is locked and awake. A sleeping Mac is offline.';
export const awakeNote = 'Computer awake · works while its screen is locked';
export const lockedNote = 'Computer locked · awake';
export const unlockedNote = 'Computer unlocked · awake';
export const approveNote = 'Approve this phone in Harness on your computer.';
export const awayNote = 'It is asleep or has no network. Nothing is sent until it is back.';
export const revokedNote = 'Pair again from your computer to continue.';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** A relay as a person recognises it: its host, never a path or a query. */
export function relayName(origin: string | null): string {
	try {
		return new URL(origin ?? '').host;
	} catch {
		return '';
	}
}
/** The time an offer has left, as minutes and seconds; never less than nothing. */
export function timeLeft(milliseconds: number): string {
	const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
/** The start of a device identity, which is the hash of its key, in groups a person can compare. */
export function keyLabel(deviceId: string): string {
	return (deviceId.slice(0, 12).match(/.{1,4}/g) ?? []).join(' ');
}
/** A whole device identity, which is the hash of its key, in groups a person can compare. */
export function identityLabel(deviceId: string): string {
	return (deviceId.match(/.{1,4}/g) ?? []).join(' ');
}
export function grantLabel(grant: { agents: boolean; comments?: boolean }): string {
	if (grant.comments === undefined)
		return grant.agents ? 'Plan and Change allowed' : 'Read and comment only';
	if (grant.agents) return 'Write · read, comment and ask AI';
	return grant.comments === false ? 'Read only' : 'Comment · read and comment';
}
export function grantSummary(grant: { projects: unknown[]; agents: boolean }): string {
	return `${plural(grant.projects.length, 'project')} · ${grantLabel(grant)}`;
}

const progress: Partial<Record<RemoteHostStatus['state'], string>> = {
	registering: ' · registering…',
	connecting: ' · connecting…',
	offline: ' · relay unreachable'
};
/** The desktop's own state in one line; the relay is named so a person sees where phones go. */
export function hostLine(status: RemoteHostStatus): string {
	return `Phone access is on · ${relayName(status.origin)}${progress[status.state] ?? ''}`;
}
export function hostSummary(status: RemoteHostStatus): string {
	if (!status.enabled) return 'Phone access off';
	const count = status.devices.length;
	return `Phone access on · ${count ? plural(count, 'phone') : 'no phone'}`;
}

/** The lock state is stated only when the computer reported one; otherwise only that it is awake. */
function awake(status: RemoteNativeStatus): string {
	if (typeof status.locked !== 'boolean') return awakeNote;
	return status.locked ? lockedNote : unlockedNote;
}

type Words = (host: string, status: RemoteNativeStatus) => { title: string; detail: string };
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
