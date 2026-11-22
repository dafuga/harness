import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi } from 'vitest';
import type { Browser } from '@playwright/test';
import type {
	NativeRecording,
	NativeRecordingOptions,
	NativeRecordingSession
} from '../../src/services/verification-evidence/NativeVideoRecorderService.types';
import type { VideoCaptureScriptInput } from '../../src/services/verification-evidence/VideoCaptureService.types';
import { mediaFacts } from '../../src/utils/verification-evidence/mediaFacts';

function encoded(root: string, color: string) {
	const path = join(root, `.cache/${color}.mp4`),
		poster = join(root, `.cache/${color}.png`);
	const result = spawnSync(
		'ffmpeg',
		[
			'-v',
			'error',
			'-f',
			'lavfi',
			'-i',
			`color=${color}:size=160x120:rate=30:duration=2`,
			'-an',
			'-c:v',
			'libx264',
			'-threads',
			'1',
			'-pix_fmt',
			'yuv420p',
			'-movflags',
			'+faststart',
			'-y',
			path
		],
		{ timeout: 10_000 }
	);
	if (result.status !== 0) throw new Error('Capture video fixture encoding failed');
	const image = spawnSync(
		'ffmpeg',
		[
			'-v',
			'error',
			'-threads',
			'1',
			'-i',
			path,
			'-frames:v',
			'1',
			'-threads',
			'1',
			'-f',
			'image2pipe',
			'-vcodec',
			'png',
			'pipe:1'
		],
		{ timeout: 10_000 }
	);
	writeFileSync(poster, image.stdout);
	return { path, poster };
}

export function captureNativeFixture(root: string) {
	mkdirSync(join(root, '.cache'), { recursive: true });
	const media = [encoded(root, 'blue'), encoded(root, 'red')];
	const session = {} as NativeRecordingSession;
	const produced: NativeRecording[] = [],
		cacheRoots: string[] = [];
	const browserFactory = vi.fn(
		async () => ({ close: vi.fn(async () => {}) }) as unknown as Browser
	);
	const loadScript = vi.fn(async (_input: VideoCaptureScriptInput) => fixtureScript());
	const record = vi.fn(async (options: NativeRecordingOptions): Promise<NativeRecording> => {
		await options.prepare(session);
		const events: NativeRecording['metadata']['events'] = [];
		await options.perform({
			...session,
			mark: async (kind, id) => {
				events.push({
					kind,
					id,
					timestamp: events.length,
					atSeconds: (events.length + 1) / 3,
					frameNumber: (events.length + 1) * 10
				});
			}
		});
		const source = media[JSON.parse(options.slotKey)[1] === 'first' ? 0 : 1];
		const directory = join(cacheRoots.at(-1)!, String(produced.length));
		mkdirSync(join(directory, 'raw'), { recursive: true });
		const result = recordedNative(options, events, { source, directory });
		produced.push(result);
		return result;
	});
	const acknowledge = vi.fn(async (item: NativeRecording) => {
		rmSync(join(item.directory, 'raw'), { recursive: true, force: true });
	});
	const factory = (directory: string) => {
		cacheRoots.push(directory);
		return {
			record,
			acknowledge,
			lookup: vi.fn(async (slot: string, hash: string) =>
				produced.find(
					(p) =>
						p.directory.startsWith(directory + '/') &&
						p.metadata.slotKey === slot &&
						p.metadata.inputHash === hash
				)
			)
		};
	};
	return { factory, record, acknowledge, browserFactory, loadScript, cacheRoots, produced };
}

function fixtureFile(path: string) {
	const data = readFileSync(path);
	return {
		path,
		file: path,
		sha256: createHash('sha256').update(data).digest('hex'),
		bytes: data.length,
		data
	};
}

function recordedNative(
	options: NativeRecordingOptions,
	events: NativeRecording['metadata']['events'],
	state: { source: { path: string; poster: string }; directory: string }
): NativeRecording {
	copyFileSync(state.source.path, join(state.directory, 'clip.mp4'));
	copyFileSync(state.source.poster, join(state.directory, 'poster.png'));
	const video = fixtureFile(join(state.directory, 'clip.mp4')),
		poster = fixtureFile(join(state.directory, 'poster.png'));
	return {
		directory: state.directory,
		video,
		poster,
		metadata: {
			schemaVersion: 1,
			slotKey: options.slotKey,
			inputHash: options.inputHash,
			testedRevision: options.testedRevision,
			capturedAt: new Date().toISOString(),
			addressedFlags: options.addressedFlags ?? [],
			viewport: options.viewport,
			recipe: 'native-jpeg-sample-previous-h264-yuv420p-30fps-v1',
			marker: { shownTimestamp: 0, removedTimestamp: 0, nativeTimestamp: 0 },
			interval: { startTimestamp: 0, endTimestamp: 2 },
			native: { frames: [], meanFrameRate: 30, maxGapMs: 34, bytes: video.bytes },
			mapping: [],
			events,
			facts: mediaFacts(video.data, 'video/mp4'),
			posterFrame: 0,
			elapsedMs: 1,
			runnerRssBytes: 1
		}
	} as NativeRecording;
}

function fixtureScript() {
	return {
		diagnostics: { watch() {}, async finish() {} },
		async prepare() {},
		async perform({ mark }: Parameters<NativeRecordingOptions['perform']>[0]) {
			await mark('state', 'ready');
			await mark('edge', 'finish');
			await mark('state', 'done');
		}
	};
}
