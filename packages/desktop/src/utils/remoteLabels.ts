

export const lockNote =
	'Approved phones keep working while this Mac is locked and awake. A sleeping Mac is offline.';

export const awakeNote = 'Computer awake · works while its screen is locked';

export const lockedNote = 'Computer locked · awake';

export const unlockedNote = 'Computer unlocked · awake';

export const approveNote = 'Approve this phone in Harness on your computer.';

export const awayNote = 'It is asleep or has no network. Nothing is sent until it is back.';

export const revokedNote = 'Pair again from your computer to continue.';

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

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

export { relayName, hostLine, hostSummary } from '../components/remote-host-panel/remoteLabels';
export { timeLeft } from '../components/remote-offer-code/remoteLabels';
export { grantSummary, remoteLabels } from '../components/remote-phone-panel/remoteLabels';
