import type { HarnessCapture, HarnessScenario } from '../src/models/explorer-ui/Harness.types';
import { explorerState, type Judged } from '../src/utils/explorer-ui/explorerState';
import { capture, declared, record, result, sha } from './explorerFixture';

type Video = NonNullable<HarnessScenario['video']>;

const unit = 'page.functions';
const digest = (letter: string) => letter.repeat(64);
const signatures = { entrySignature: digest('1'), exitSignature: digest('2') };

/** A finite clip of the catalog state at desktop; each clip id names its own recorded proof. */
function clip(id: string) {
	return {
		id,
		unit,
		state: 'catalog',
		viewports: ['desktop'],
		inputs: ['packages/reports/src/utils/a.ts'],
		script: { path: 'test/record.ts', export: 'record' },
		fixture: 'test/fixture.json',
		entry: 'ready',
		exit: 'done',
		states: ['ready', 'done'],
		edges: ['finish'],
		durationSeconds: 3,
		checkpoints: [{ viewport: 'desktop', ...signatures }]
	};
}

const manifest: Video = {
	schemaVersion: 1,
	viewports: [{ id: 'desktop', width: 1440, height: 900 }],
	clips: [clip('use-first'), clip('use-second')],
	graphs: [
		{
			id: 'catalog',
			unit,
			initial: 'ready',
			terminals: ['done'],
			states: [
				{ id: 'ready', predicate: 'Ready visible' },
				{ id: 'done', predicate: 'Done visible' }
			],
			edges: [{ id: 'finish', from: 'ready', to: 'done', action: 'Finish' }],
			clips: ['use-first', 'use-second']
		}
	],
	playlists: [{ id: 'catalog', clips: ['use-first', 'use-second'] }]
};

/** A declared video scenario: one required state, one desktop viewport, two clips for it. */
export const videoCoverage = declared({
	id: 'explorer',
	title: 'Explorer',
	units: [unit],
	states: [{ id: 'catalog', coverage: 'required', units: [unit] }],
	viewports: [{ id: 'desktop', width: 1440, height: 900 }],
	evidence: [{ id: 'video', kind: 'video', states: ['catalog'], viewports: ['desktop'] }],
	video: manifest
});

/** A passed, stored clip of the catalog state, stamped with the build of the tested commit. */
export function clipCapture(clipId: string, extra: Partial<HarnessCapture> = {}): HarnessCapture {
	const video = {
		schemaVersion: 1 as const,
		clipId,
		unit,
		inputHash: digest('d'),
		entry: 'ready',
		exit: 'done',
		...signatures,
		states: [
			{ id: 'ready', atSeconds: 0.3 },
			{ id: 'done', atSeconds: 2 }
		],
		edges: [{ id: 'finish', atSeconds: 1 }],
		profile: 'normal' as const,
		width: 1440,
		height: 900,
		frameRate: 30,
		sourceFrameRate: 30,
		frameCount: 90,
		poster: { file: 'poster.png', sha256: digest('e'), bytes: 1, timeSeconds: 1 }
	};
	return capture({
		evidence: 'video',
		kind: 'video',
		state: 'catalog',
		viewport: 'desktop',
		path: `evidence/${clipId}.mp4`,
		media: `media/${clipId}.mp4`,
		sha256: digest('c'),
		mediaType: 'video/mp4',
		provenance: 'actual-capture',
		durationSeconds: 3,
		video,
		...extra
	});
}

/** The two clips of the catalog state at desktop, each passed and stored. */
export const clips = [clipCapture('use-first'), clipCapture('use-second')];

/** The second clip of the catalog state, as the recorder rejected it. */
export const failedSecond = clipCapture('use-second', { status: 'failed' });

/** The clip each slot of the catalog state holds, in declared order: one slot per declared clip. */
export function clipSlots(judged: Judged): Array<string | undefined> {
	const [state] = videoCoverage.states;
	return explorerState(judged, state, ['incomplete', '']).slots.map(
		(slot) => slot.capture?.video?.clipId
	);
}

/** The judged video scenario whose catalog state holds the given captures from the tested commit. */
export function videoJudge(captures: HarnessCapture[]): Judged {
	const scenario = result([], { states: [{ id: 'catalog', coverage: 'required', captures }] });
	return {
		declared: videoCoverage,
		result: scenario,
		record: record([scenario]),
		bound: sha('a')
	};
}
