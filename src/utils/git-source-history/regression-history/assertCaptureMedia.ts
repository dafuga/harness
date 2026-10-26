import type { Capture } from '../../../core/verification-evidence/verificationTypes';
import { fail } from '../../../core/development-tooling/errors';
import { mediaFacts } from '../../verification-evidence/mediaFacts';

/** Decoding and revision checks preserve the media's kind and original class identity. */
export function assertCaptureMedia(
	capture: Capture,
	bytes: Buffer,
	commit: string,
	unit: string
): void {
	const expected = decodedKind(capture.kind),
		facts = mediaFacts(bytes, capture.mediaType);
	if ('error' in facts || !expected || facts.kind !== expected)
		fail(`Focused capture ${capture.path} cannot be decoded.`);
	if (capture.kind === 'audio') assertAudioIdentity(capture, commit, unit);
	else if (capture.provenance === 'actual-capture' && capture.server?.revision !== commit)
		fail(`Focused capture ${capture.path} has a different served revision.`);
}

function decodedKind(kind: Capture['kind']): string | undefined {
	if (kind === 'screenshot') return 'image';
	if (kind === 'audio') return 'audio';
	return undefined;
}

function assertAudioIdentity(capture: Capture, commit: string, unit: string): void {
	const note = audioBinding(capture.note);
	if (note.unit !== unit || note.revision !== commit || note.sha256 !== capture.sha256)
		fail(`Focused audio ${capture.path} has a different unit, revision or media hash.`);
	if (!validAudioDetails(note, capture))
		fail(`Focused audio ${capture.path} has an invalid artifact binding.`);
}

function validAudioDetails(note: Record<string, unknown>, capture: Capture): boolean {
	return (
		typeof note.case === 'string' &&
		/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(note.case) &&
		Boolean(capture.transcript?.trim()) &&
		['fixture', 'actual-capture'].includes(capture.provenance ?? '')
	);
}

function audioBinding(note: string | undefined): Record<string, unknown> {
	try {
		const parsed: unknown = JSON.parse(note ?? 'null');
		if (
			parsed &&
			typeof parsed === 'object' &&
			!Array.isArray(parsed) &&
			Object.keys(parsed).sort().join(',') === 'case,revision,sha256,unit'
		)
			return parsed as Record<string, unknown>;
	} catch {
		/* Corrupt artifact bindings remain explicit history gaps. */
	}
	return fail('Focused audio requires its registered artifact binding.');
}
