import { expect, test } from 'vitest';
import { formatTrackerHostBrief } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostBrief';
import type { TrackerItem } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';

const item = {
	id: 'abcdef1234567890',
	title: 'Synthetic task',
	stage: 'idea',
	notes: 'Do the synthetic work.',
	notes_log: [],
	sensitive: false
} as unknown as TrackerItem;

test('every session brief tells the agent to flag with 2 to 4 options and one recommendation', () => {
	const brief = formatTrackerHostBrief(item, 'Finish by running tracker done.');
	expect(brief).toContain('## Asking Daniel');
	expect(brief).toContain('--option "<label>=<what happens if chosen>"');
	expect(brief).toContain('--recommend');
	expect(brief).toContain('--confirm deploy|money|secret');
	expect(brief.indexOf('## Secret-safe computer use')).toBeLessThan(brief.indexOf('## Asking'));
	expect(brief).toContain('Current planning stage: idea');
	expect(brief).toContain('For a new user-facing feature');
	expect(brief).toContain('tracker artifact abcdef idea');
	expect(brief).toContain('tracker stage abcdef detail');
	expect(brief).toContain('main-page designs');
	expect(brief).toContain('tracker stage abcdef design');
	expect(brief).toContain('design every page and its applicable states');
	expect(brief).toContain('tracker stage abcdef build');
	expect(brief.indexOf('tracker stage abcdef detail')).toBeLessThan(
		brief.indexOf('tracker stage abcdef design')
	);
	expect(brief.indexOf('tracker stage abcdef design')).toBeLessThan(
		brief.indexOf('tracker stage abcdef build')
	);
	expect(formatTrackerHostBrief({ ...item, stage: 'detail' }, '', true)).toContain(
		'Current planning stage: detail'
	);
});
