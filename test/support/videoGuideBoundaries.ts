import { expect } from 'vitest';
import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import { unitVideoShots } from '../../src/workflows/development-tooling/guide-units/unitVideoShots';
import type { ExplorerCapture } from '../../packages/reports/src/models/explorer-ui/ExplorerEvidence.types';
import { videoEnrollment } from './videoEnrollmentFixture';

/** Guide completion requires compatible observed boundaries and a finished finite inventory. */
export function assertVideoGuideBoundaries() {
	const entity = 'component.widget',
		point = { viewport: 'desktop', entrySignature: '1'.repeat(64), exitSignature: '2'.repeat(64) };
	const declaration = videoEnrollment(entity, 'default', [
		{ id: 'desktop', width: 920, height: 700 }
	]);
	const scenario = scenarioManifestSchema.parse({
		schemaVersion: 1,
		id: 'video-guide',
		title: 'Video guide',
		kind: 'ui',
		units: [entity],
		states: [{ id: 'default', title: 'Default', coverage: 'required', motion: 'required' }],
		viewports: declaration.viewports,
		tests: [{ id: 'video', kind: 'e2e', runner: 'command', target: 'record' }],
		evidence: [
			{ id: 'video', kind: 'video', states: ['default'], viewports: ['desktop'], required: true }
		],
		video: {
			...declaration,
			clips: declaration.clips.map((clip) => ({ ...clip, checkpoints: [point] }))
		}
	});
	const video = {
		schemaVersion: 1,
		clipId: 'use-feature',
		unit: entity,
		inputHash: 'd'.repeat(64),
		entry: 'ready',
		exit: 'done',
		...point,
		profile: 'normal',
		width: 920,
		height: 700,
		frameRate: 30,
		sourceFrameRate: 30,
		frameCount: 90,
		states: [
			{ id: 'ready', atSeconds: 0.3 },
			{ id: 'done', atSeconds: 2 }
		],
		edges: [{ id: 'finish', atSeconds: 1 }],
		poster: { file: 'poster.png', sha256: 'e'.repeat(64), bytes: 1, timeSeconds: 1 }
	};
	delete (video as { viewport?: string }).viewport;
	const capture = {
		evidence: 'video',
		kind: 'video',
		state: 'default',
		viewport: 'desktop',
		status: 'passed',
		path: 'evidence/clip.mp4',
		media: 'media/clip.mp4',
		sha256: 'c'.repeat(64),
		bytes: 1,
		capturedAt: 'now',
		mediaType: 'video/mp4',
		durationSeconds: 3,
		provenance: 'actual-capture',
		video
	};
	const item = {
		scenario: scenario.id,
		state: 'default',
		capture,
		standing: 'fresh',
		usable: true,
		current: true,
		inheritedFrom: null
	} as ExplorerCapture;
	const screenshot = { ...item, capture: { ...capture, kind: 'screenshot' } } as ExplorerCapture;
	expect(unitVideoShots([item, screenshot], [scenario], entity).captures).toHaveLength(2);
	const incompatible = {
		...item,
		capture: { ...item.capture, video: { ...video, exitSignature: 'f'.repeat(64) } }
	} as ExplorerCapture;
	expect(
		unitVideoShots([incompatible, screenshot], [scenario], entity).captures,
		'guide must reject incompatible observed video boundaries'
	).toHaveLength(0);
	const unknown = {
		...scenario,
		video: {
			...scenario.video!,
			discoveryGaps: [{ unit: entity, reason: 'Retry states await inventory.' }]
		}
	};
	const gaps = unitVideoShots([item, screenshot], [unknown], entity);
	expect(gaps.captures, 'unresolved discovery must keep the guide incomplete').toHaveLength(0);
	expect(gaps.gap).toContain('Retry states await inventory.');
}
