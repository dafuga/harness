import { expect, test } from 'vitest';
import {
	evidenceNotice,
	readingEvidence,
	unavailableEvidence
} from '../../src/utils/evidenceNotice';

test('what is said in place of evidence names why there is none', () => {
	expect(evidenceNotice('ready', '', 'page')).toBeNull();
	expect(evidenceNotice('loading', '', 'page')).toEqual({ text: readingEvidence, alert: false });
	expect(evidenceNotice('idle', '', 'page')).toEqual({ text: readingEvidence, alert: false });
	expect(evidenceNotice('unavailable', '', 'page')?.text).toBe(unavailableEvidence);
	expect(evidenceNotice('planned', '', 'service')?.text).toBe(
		'This service is planned and not implemented: nothing is recorded for it.'
	);
});

test('a failed read is an alert in the words of the backend', () => {
	expect(evidenceNotice('failed', 'forbidden', 'page')).toEqual({
		text: 'Recorded evidence could not be read: forbidden',
		alert: true
	});
});
