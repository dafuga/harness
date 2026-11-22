import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import {
	unavailableEvidence,
	readingEvidence,
	evidenceNotice
} from '../../src/utils/verification-evidence/evidenceNotice';
import type { EvidenceStatus, EvidenceNotice } from '../../src/utils/verification-evidence/evidenceNotice.types';

const unitId = 'desktop.function.evidence-notice';

test('Explains that a planned entity has nothing recorded', () => {
	const status: EvidenceStatus = 'planned';
	const notice: EvidenceNotice | null = evidenceNotice(status, '', 'function');

	expect(notice).toEqual({
		text: 'This function is planned and not implemented: nothing is recorded for it.',
		alert: false
	});

	recordExampleCases(
		{
			unitId,
			symbol: 'evidenceNotice',
			state: 'explains-that-a-planned-entity-has-nothing-recorded',
			evidence: 'examples-cases',
			file: 'explains-that-a-planned-entity-has-nothing-recorded.json'
		},
		[{ name: 'planned function notice', input: { status, error: '', kind: 'function' }, output: notice }]
	);
});

test('Raises the backend failure as the only alert', () => {
	const timeout: EvidenceNotice | null = evidenceNotice('failed', 'request timed out', 'module');
	const reset: EvidenceNotice | null = evidenceNotice('failed', 'connection reset by peer', 'module');

	expect(timeout).toEqual({
		text: 'Recorded evidence could not be read: request timed out',
		alert: true
	});
	expect(reset).toEqual({
		text: 'Recorded evidence could not be read: connection reset by peer',
		alert: true
	});

	recordExampleCases(
		{
			unitId,
			symbol: 'evidenceNotice',
			state: 'raises-the-backend-failure-as-the-only-alert',
			evidence: 'examples-cases',
			file: 'raises-the-backend-failure-as-the-only-alert.json'
		},
		[
			{ name: 'failed read with a timeout', input: { status: 'failed', error: 'request timed out', kind: 'module' }, output: timeout },
			{ name: 'failed read with a reset', input: { status: 'failed', error: 'connection reset by peer', kind: 'module' }, output: reset }
		]
	);
});

test('Gives the unavailable and reading notices, none when ready', () => {
	const unavailable = evidenceNotice('unavailable', '', 'component');
	const idle = evidenceNotice('idle', '', 'component');
	const loading = evidenceNotice('loading', '', 'component');
	const ready = evidenceNotice('ready', '', 'component');

	expect(unavailable).toEqual({ text: unavailableEvidence, alert: false });
	expect(idle).toEqual({ text: readingEvidence, alert: false });
	expect(loading).toEqual({ text: readingEvidence, alert: false });
	expect(ready).toBeNull();

	recordExampleCases(
		{
			unitId,
			symbol: 'evidenceNotice',
			state: 'gives-the-unavailable-and-reading-notices-none-when-ready',
			evidence: 'examples-cases',
			file: 'gives-the-unavailable-and-reading-notices-none-when-ready.json'
		},
		[
			{ name: 'unavailable connection', input: { status: 'unavailable', error: '', kind: 'component' }, output: unavailable },
			{ name: 'idle reads recorded evidence', input: { status: 'idle', error: '', kind: 'component' }, output: idle },
			{ name: 'loading reads recorded evidence', input: { status: 'loading', error: '', kind: 'component' }, output: loading },
			{ name: 'ready has no notice', input: { status: 'ready', error: '', kind: 'component' }, output: ready }
		]
	);
});
