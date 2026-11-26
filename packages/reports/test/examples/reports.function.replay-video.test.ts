import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import type { Report } from '../../src/models/reports-media/Report.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { replayVideo } from '../../src/routes/api/replay-video/replay-video-service/replayVideo';
import { replayVideoKey } from '../../src/utils/reports-media/replayVideo';
import type { Item } from './reports.function.replay-video.test.types';

const BEFORE_FILE = '5d1c8a0f3e7b92d4c6a1e8f05b3d7c29e4a6f1b8d0c3e5a7f9b2d4c6e8a0f1b3.png';
const AFTER_FILE = 'a92f4c1e7d0b3e861c5a9f24e0d7b3c86f1a4e9d2b8c0f57d3e6a1b94c7f2e05.png';

function item(id: string, file: string, phase: Item['phase']): Item {
	return {
		id,
		title: 'Checkout summary',
		category: 'Uploaded comparison',
		file,
		status: 'not-proven',
		source: 'Manual upload · Cloudflare R2',
		capturedAt: '2026-11-14T16:07:03.912Z',
		viewport: '1440px desktop',
		phase,
		comparison: 'c6a8e2d0-4f1b-4c7e-9a35-0d2b7e1f8a44',
		storage: 'r2'
	};
}

function reportWith(evidence: Item[]): Report {
	return {
		schemaVersion: 1,
		id: '3b241101-e2bb-4255-8caf-4136c566a962',
		project: { id: '9f2c4e7a1b3d5c60', name: 'example-app', path: '/workspace/project' },
		title: 'Checkout summary',
		mode: 'feature',
		environment: 'local',
		historical: false,
		startedAt: '2026-11-14T16:05:12.441Z',
		updatedAt: '2026-11-14T16:07:03.912Z',
		summary: 'Checkout summary comparison captured for review.',
		status: 'running',
		state: 'active',
		checks: [],
		evidence,
		findings: [],
		coverage: [],
		acceptance: ['Checkout summary matches the approved design']
	};
}

const REPORT = reportWith([
	item('c6a8e2d0-4f1b-4c7e-9a35-0d2b7e1f8a44-before', BEFORE_FILE, 'before'),
	item('c6a8e2d0-4f1b-4c7e-9a35-0d2b7e1f8a44-after', AFTER_FILE, 'after')
]);
const NO_FRAMES = reportWith([
	item('c6a8e2d0-4f1b-4c7e-9a35-0d2b7e1f8a44-before', BEFORE_FILE, 'before')
]);
const REPORT_META = {
	unitId: 'reports.function.replay-video',
	evidence: 'examples-cases',
	symbol: 'replayVideoKey'
};

test('Replay key is a 64-character digest of the frame list', () => {
	const key = replayVideoKey(REPORT);
	const emptyKey = replayVideoKey(NO_FRAMES);

	expect(key).toMatch(/^[0-9a-f]{64}$/);
	expect(emptyKey).toMatch(/^[0-9a-f]{64}$/);
	expect(emptyKey).not.toBe(key);
	recordExampleCases(
		{
			...REPORT_META,
			state: 'replay-key-is-a-64-character-digest-of-the-frame-list',
			file: 'replay-key-is-a-64-character-digest-of-the-frame-list.json'
		},
		[
			{ name: 'report with one after screenshot', input: { frames: ['after'] }, output: { key } },
			{
				name: 'report with no replay frames still yields a key',
				input: { frames: [] },
				output: { key: emptyKey }
			}
		]
	);
});

test('Returns an existing cached replay without rendering', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'replay-video-cache-'));
	try {
		const key = replayVideoKey(REPORT);
		const cache = join(directory, 'replays');
		mkdirSync(cache, { recursive: true });
		writeFileSync(join(cache, `${key}.mp4`), 'cached');

		const result = await replayVideo(REPORT, directory);

		expect(result).toBe(join(cache, `${key}.mp4`));
		recordExampleCases(
			{
				unitId: 'reports.function.replay-video',
				symbol: 'replayVideo',
				state: 'returns-an-existing-cached-replay-without-rendering',
				evidence: 'examples-cases',
				file: 'returns-an-existing-cached-replay-without-rendering.json'
			},
			[
				{
					name: 'cached MP4 already exists for the frame key',
					input: { frames: ['before-skipped', 'after'] },
					output: { path: `replays/${key}.mp4` }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Rejects a replays folder that is a symbolic link', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'replay-video-link-'));
	try {
		mkdirSync(join(directory, 'elsewhere'));
		symlinkSync(join(directory, 'elsewhere'), join(directory, 'replays'));

		await expect(replayVideo(REPORT, directory)).rejects.toThrow('Invalid replay directory');
		recordExampleCases(
			{
				unitId: 'reports.function.replay-video',
				symbol: 'replayVideo',
				state: 'rejects-a-replays-folder-that-is-a-symbolic-link',
				evidence: 'examples-cases',
				file: 'rejects-a-replays-folder-that-is-a-symbolic-link.json'
			},
			[
				{
					name: 'replays entry is a symbolic link',
					input: { frames: ['after'], replays: 'symbolic-link' },
					error: { message: 'Invalid replay directory' }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Rejects a report with no replay screenshots', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'replay-video-empty-'));
	try {
		await expect(replayVideo(NO_FRAMES, directory)).rejects.toThrow(
			'Replay requires between 1 and 500 available screenshots'
		);
		recordExampleCases(
			{
				unitId: 'reports.function.replay-video',
				symbol: 'replayVideo',
				state: 'rejects-a-report-with-no-replay-screenshots',
				evidence: 'examples-cases',
				file: 'rejects-a-report-with-no-replay-screenshots.json'
			},
			[
				{
					name: 'only a before screenshot is available',
					input: { frames: [] },
					error: { message: 'Replay requires between 1 and 500 available screenshots' }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
