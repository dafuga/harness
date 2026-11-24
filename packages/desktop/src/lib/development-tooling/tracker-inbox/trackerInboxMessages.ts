// @harness-uid u_wjfyfu2l5m
import type { WriteAction } from '../../../models/development-tooling/TrackerInbox.types';

const failures: Record<string, string> = {
	staleReview: 'The item changed since you reviewed it. Review it again before you write.',
	noFlag: 'This flag is already answered.',
	noLocalMatch: 'This item is not on the phone copy any more.',
	invalidInput:
		'This text cannot be sent. Shorten it and remove paths, links, or anything that looks like a secret.',
	queueFull: '100 writes are already waiting. Review them below first.',
	noReplica: 'The Tracker copy is not ready. Connect to your computer and try again.',
	denied: 'This phone no longer has permission to write Tracker items.',
	cancelled: 'Cancelled on the phone. Nothing was queued.',
	unavailable: 'The Tracker copy could not take the write. Try again after it syncs.'
};

const kinds: Record<WriteAction, string> = { note: 'Note', flag: 'Flag', answer: 'Answer' };

export function writeSentMessage(action: WriteAction, mode: 'phone' | 'mac' = 'phone'): string {
	if (mode === 'mac') return `${kinds[action]} saved to Tracker.`;
	return `${kinds[action]} confirmed and queued. It reaches the Tracker when this phone is connected.`;
}

export function writeFailureMessage(
	code: string | undefined,
	mode: 'phone' | 'mac' = 'phone'
): string {
	if (mode === 'mac') {
		switch (code) {
			case 'staleReview':
				return failures.staleReview;
			case 'noLocalMatch':
				return 'This Tracker item is unavailable.';
			case 'invalidInput':
				return 'Enter up to 512 bytes of text and review it again.';
			case 'writeConflict':
				return 'Tracker declined the write. Review the item and try again.';
			default:
				return 'Tracker could not confirm the write. Review the item before retrying.';
		}
	}
	return failures[code ?? ''] ?? 'The write did not go through. Nothing was queued.';
}
