import { expect, test } from 'vitest';
import { formatTrackerHostBrief } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostBrief';
import type { TrackerItem } from '../../../src/repositories/projects-sessions/TrackerItemReadRepository.types';

const item = {
	id: 'abcdef1234567890',
	title: 'Synthetic task',
	notes: 'Do the synthetic work.',
	notes_log: [],
	sensitive: false
} as unknown as TrackerItem;

test('session briefs preserve approval and video acceptance instructions before task content', () => {
	const brief = formatTrackerHostBrief(item, 'Finish by running tracker done.');
	expect(brief).toContain('## Asking Daniel');
	expect(brief).toContain('--option "<label>=<what happens if chosen>"');
	expect(brief).toContain('--recommend');
	expect(brief).toContain('--confirm deploy|money|secret');
	expect(brief.indexOf('## Secret-safe computer use')).toBeLessThan(brief.indexOf('## Asking'));
	expect(brief).toContain(
		'If the task asks for a video, deliver a screen recording of the real app.'
	);
	expect(brief).toContain(
		'In the acceptance evidence, list the timestamp of each extracted frame and describe what it shows.'
	);
	expect(brief).toContain('ffprobe output alone is insufficient.');
	expect(brief.indexOf('## Video evidence')).toBeLessThan(brief.indexOf('# Synthetic task'));
});
