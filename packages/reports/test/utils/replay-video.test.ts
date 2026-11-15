import { expect, test } from 'vitest';
import { replayVideoKey } from '../../src/utils/reports-media/replayVideo';
import type { Report } from '../../src/models/reports-media/Report.types';
const report = (id: string): Report =>
	({
		evidence: [{ id, title: 'Scene 1', file: id + '.jpg', status: 'passed', category: 'Game' }]
	}) as Report;
test('a replay cache key changes with registered frames, not unrelated report metadata', () => {
	const first = report('one');
	expect(replayVideoKey(first)).toHaveLength(64);
	expect(replayVideoKey({ ...first, summary: 'Updated check' })).toBe(replayVideoKey(first));
	expect(replayVideoKey(report('two'))).not.toBe(replayVideoKey(first));
});
