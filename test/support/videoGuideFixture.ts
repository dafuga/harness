import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import type { ExplorerCapture } from '../../packages/reports/src/models/explorer-ui/ExplorerEvidence.types';
import { videoEnrollment } from './videoEnrollmentFixture';

export function videoGuideFixture() {
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
	const { video, capture } = guideCapture(entity, point);
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
	return { entity, point, scenario, video, item, screenshot };
}

function guideCapture(
	entity: string,
	point: { viewport: string; entrySignature: string; exitSignature: string }
) {
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
	return { video, capture };
}
