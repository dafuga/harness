import { expect, test } from 'vitest';
import { displayTime, revisionTime } from '../../src/utils/revisionTime';
import type { ProjectSnapshot } from '../../src/models/Desktop.types';
test('commit and branch timestamps follow their own revisions, never a deployment or current clock', () => {
	const snapshot = {
		revision: { commit: 'old', tip: 'tip' },
		commits: [
			{ hash: 'old', authoredAt: '2026-10-01', committedAt: '2026-10-02' },
			{ hash: 'tip', authoredAt: '2026-10-05' }
		]
	} as unknown as ProjectSnapshot;
	expect(revisionTime(snapshot, 'commit')).toBe('2026-10-02');
	expect(revisionTime(snapshot, 'branch')).toBe('2026-10-05');
	expect(revisionTime(null, 'branch')).toBeNull();
	expect(displayTime(null)).toBe('Unknown');
	expect(displayTime('invalid')).toBe('Unknown');
});
