import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { audioPairs } from '../../src/utils/reports-media/audioPairs';
import type { Comparable } from '../../src/utils/reports-media/audioPairs.types';

function audio(id: string, phase: 'before' | 'after', comparison: string, viewport = 'desktop') {
	return {
		id,
		title: id,
		category: 'verification',
		file: `${id}.wav`,
		status: 'passed',
		mediaType: 'audio',
		phase,
		comparison,
		viewport
	} satisfies Comparable;
}

test('Pairs only unambiguous matching audio evidence', () => {
	const paired = [audio('before-1', 'before', 'voice-check'), audio('after-1', 'after', 'voice-check')];
	const incomplete = [audio('before-2', 'before', 'incomplete')];
	const duplicate = [
		audio('before-3a', 'before', 'duplicate'),
		audio('before-3b', 'before', 'duplicate'),
		audio('after-3', 'after', 'duplicate')
	];
	const entries = [...audioPairs(paired), ...audioPairs(incomplete), ...audioPairs(duplicate)];
	const summary = entries.map(([afterId, before]) => [afterId, before.id]);

	expect(summary).toEqual([['after-1', 'before-1']]);
	recordExampleCases(
		{
			unitId: 'reports.function.audio-pairs',
			symbol: 'audioPairs',
			state: 'pairs-only-unambiguous-matching-audio-evidence',
			evidence: 'examples-cases',
			file: 'pairs-only-unambiguous-matching-audio-evidence.json'
		},
		[
			{
				name: 'one before and one after record form a pair',
				input: paired,
				output: [['after-1', 'before-1']]
			},
			{
				name: 'a group missing its after record is omitted',
				input: incomplete,
				output: []
			},
			{
				name: 'a group with duplicate before records is omitted',
				input: duplicate,
				output: []
			}
		]
	);
});
