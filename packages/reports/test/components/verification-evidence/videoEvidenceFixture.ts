import type { Evidence } from '../../../src/models/reports-media/Report.types';
import type { FrameFlag } from '../../../../../src/services/verification-evidence/FrameFlagService.types';

const reference = {
	record: 'a'.repeat(64),
	revision: 'b'.repeat(40),
	unit: 'component.spinner',
	clipId: 'spinner',
	viewport: 'desktop'
};
export const videoItem = {
	id: 'spinner-video',
	title: 'Spinner loading',
	category: 'motion',
	file: 'clip.mp4',
	status: 'passed',
	mediaType: 'video',
	mimeType: 'video/mp4',
	durationSeconds: 2,
	video: {
		schemaVersion: 1,
		clipId: 'spinner',
		unit: reference.unit,
		inputHash: 'c'.repeat(64),
		entry: 'loading',
		exit: 'loading',
		states: [{ id: 'loading', atSeconds: 0.3 }],
		edges: [{ id: 'start', atSeconds: 0.4 }],
		profile: 'normal',
		width: 920,
		height: 700,
		frameRate: 25,
		sourceFrameRate: 25,
		frameCount: 50,
		poster: {
			file: 'poster.png',
			url: 'poster.png',
			sha256: 'd'.repeat(64),
			bytes: 100,
			timeSeconds: 0.3
		},
		sha256: 'e'.repeat(64),
		reference,
		selectedRevision: 'b'.repeat(40),
		freshness: 'current'
	}
} as unknown as Evidence;
export const frameFlags: FrameFlag[] = ['active', 'stale', 'resolved'].map((status, index) => ({
	schemaVersion: 1,
	id: `11111111-1111-4111-8111-11111111111${index}`,
	clip: { ...reference, sha256: 'e'.repeat(64), inputHash: 'c'.repeat(64) },
	atSeconds: (index + 1) / 4,
	frameNumber: index + 1,
	note: 'Inspect this edge',
	source: 'human',
	createdAt: '2026-11-15T19:00:00.000Z',
	status: status as FrameFlag['status'],
	frame: { file: 'frame.png', sha256: 'f'.repeat(64), bytes: 100, mediaType: 'image/png' },
	evidence: { commit: 'a'.repeat(40), path: 'video-feedback/fixture' }
}));
