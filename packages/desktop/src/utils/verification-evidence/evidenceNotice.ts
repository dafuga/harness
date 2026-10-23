import type { EvidenceStatus, EvidenceNotice } from './evidenceNotice.types';

export const unavailableEvidence = 'Recorded runtime evidence is not available on this connection.';
export const readingEvidence = 'Reading recorded evidence…';

/**
 * What is said in place of recorded evidence while there is none to show: that the entity is
 * only planned, that this connection cannot read evidence, that it is being read, or why the
 * read failed, in the words of the backend. Null once there is evidence.
 */
export function evidenceNotice(
	status: EvidenceStatus,
	error: string,
	kind: string
): EvidenceNotice | null {
	if (status === 'ready') return null;
	if (status === 'failed')
		return { text: `Recorded evidence could not be read: ${error}`, alert: true };
	const planned = `This ${kind} is planned and not implemented: nothing is recorded for it.`;
	const said = { planned, unavailable: unavailableEvidence };
	return { text: said[status as keyof typeof said] ?? readingEvidence, alert: false };
}

export type { EvidenceStatus, EvidenceNotice } from './evidenceNotice.types';
