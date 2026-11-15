import { assertVideoBoundaryCoverage } from './videoBoundaryCoverage';
import { assertPendingVideoFlagCoverage } from './pendingVideoFlagCoverage';
import { expect } from 'vitest';
import { scenarioManifestSchema, type ScenarioManifest } from '../../src/core/unitTypes';
import type { Gathered } from '../../src/utils/verification-evidence/gatherCaptures';
import { scenarioCoverage } from '../../src/workflows/verification-evidence/run-verify/verification-service/scenarioCoverage';
import { captureLineSchema } from '../../src/core/verification-evidence/verifyTypes';
import { captureSchema } from '../../src/core/verification-evidence/verificationTypes';
const commit = 'a'.repeat(40);
export const video = {
	schemaVersion: 1,
	clipId: 'menu-open',
	unit: 'function.explorer-route',
	inputHash: 'd'.repeat(64),
	entry: 'closed',
	exit: 'pages',
	profile: 'normal',
	width: 920,
	height: 700,
	frameRate: 30,
	sourceFrameRate: 25,
	frameCount: 90,
	states: [
		{ id: 'closed', atSeconds: 0.3 },
		{ id: 'pages', atSeconds: 2 }
	],
	edges: [{ id: 'open-menu', atSeconds: 1 }],
	poster: { file: 'poster.png', sha256: 'e'.repeat(64), bytes: 1200, timeSeconds: 2 }
};

export function assertVideoCoverage(
	scenario: ScenarioManifest,
	gathered: (extra: object) => Gathered,
	served: (buildId: string) => object,
	checkpoints = false
) {
	const declared = videoScenario(scenario);
	const item: Gathered = {
		...gathered({
			kind: 'video',
			mediaType: 'video/mp4',
			viewport: 'desktop',
			durationSeconds: 3,
			video,
			...served('build-1')
		}),
		facts: {
			kind: 'video',
			width: 920,
			height: 700,
			durationSeconds: 3,
			frameRate: 30,
			frameCount: 90,
			codec: 'h264',
			pixelFormat: 'yuv420p'
		}
	};
	expect(captureLineSchema.parse(item.line)).toHaveProperty('video', video);
	expect(captureSchema.parse(item.capture)).toHaveProperty('video', video);
	const judge = (capture: Gathered) =>
		scenarioCoverage({
			scenario: declared,
			commit,
			gathered: [capture],
			checkFailed: false,
			builds: { declared: ['reports'], compiled: new Map([['reports', 'build-1']]) }
		}).failures;
	expect(judge(item)).toEqual([]);
	expect(judge({ ...item, facts: { error: 'corrupt video' } }).join(' ')).toMatch(
		/valid.*video|playable.*video/i
	);
	expect(judge({ ...item, line: { ...item.line, kind: 'screenshot' } }).join(' ')).toMatch(
		/missing/i
	);
	expect(
		judge({
			...item,
			line: { ...item.line, video: { ...video, states: [{ id: 'pages', atSeconds: 30 }] } }
		} as Gathered).join(' ')
	).toMatch(/timestamp|interval/i);
	if (checkpoints) assertVideoBoundaryCoverage(declared, item);
	return assertVideoGraphGate(declared, item);
}

export function videoLibraryFixture() {
	return {
		schemaVersion: 1,
		viewports: [{ id: 'desktop', width: 920, height: 700 }],
		clips: [
			{
				id: video.clipId,
				unit: video.unit,
				state: 'pages',
				viewports: ['desktop'],
				inputs: ['src/example.ts'],
				script: { path: 'test/example.ts', export: 'record' },
				fixture: 'test/example.json',
				entry: 'closed',
				exit: 'pages',
				states: ['closed', 'pages'],
				edges: ['open-menu'],
				durationSeconds: 3
			}
		],
		graphs: [
			{
				id: 'navigation',
				unit: video.unit,
				initial: 'closed',
				terminals: ['pages'],
				states: [
					{ id: 'closed', predicate: 'Menu is closed' },
					{ id: 'pages', predicate: 'Pages are visible' }
				],
				edges: [{ id: 'open-menu', from: 'closed', to: 'pages', action: 'Open menu' }],
				clips: [video.clipId]
			}
		],
		playlists: [{ id: 'navigation', clips: [video.clipId] }]
	};
}

function assertVideoGraphGate(scenario: ScenarioManifest, item: Gathered) {
	const enrolled = scenarioManifestSchema.parse({ ...scenario, video: videoLibraryFixture() });
	const slot = {
		unit: video.unit,
		clipId: video.clipId,
		viewport: 'desktop',
		inputHash: video.inputHash
	};
	const judge = (capture: Gathered, inputHash = video.inputHash) => {
		const input = {
			scenario: enrolled,
			commit,
			gathered: [capture],
			checkFailed: false,
			builds: { declared: ['reports'], compiled: new Map([['reports', 'build-1']]) },
			videoSlots: [{ ...slot, inputHash }]
		};
		return scenarioCoverage(input).failures;
	};
	expect(judge(item)).toEqual([]);
	assertPendingVideoFlagCoverage(enrolled, item);
	expect(judge(item, '9'.repeat(64)).join(' '), 'stale video slot must block verification').toMatch(
		/stale|hash|current/i
	);
	for (const changes of [
		{ clipId: 'unknown' },
		{ unit: 'component.other' },
		{ entry: 'pages' },
		{ exit: 'closed' },
		{ states: [{ id: 'pages', atSeconds: 2 }] },
		{ edges: [] }
	]) {
		expect(
			judge({ ...item, line: { ...item.line, video: { ...video, ...changes } } } as Gathered)
				.length,
			'unproved clip graph cannot pass'
		).toBeGreaterThan(0);
	}
	return scenarioCoverage({
		scenario: enrolled,
		commit,
		gathered: [item],
		checkFailed: false,
		builds: { declared: ['reports'], compiled: new Map([['reports', 'build-1']]) },
		videoSlots: [slot]
	});
}

function videoScenario(scenario: ScenarioManifest): ScenarioManifest {
	return scenarioManifestSchema.parse({
		...scenario,
		kind: 'ui',
		viewports: [{ id: 'desktop', width: 920, height: 700 }],
		evidence: [{ ...scenario.evidence[0], kind: 'video', viewports: ['desktop'] }]
	});
}
