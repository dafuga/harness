import type { Options } from './ui-project-data.types';
import { nativeImageFixture } from './native-image-fixture';

/** Synthetic projects of one device: two local, one shared. Both locals own `page:activity`. */
export const alpha = 'local-' + 'a'.repeat(64);
export const beta = 'local-' + 'b'.repeat(64);
export const gamma = '6f1d2c3b-4a59-4e68-9f70-8a1b2c3d4e5f';
export const tip = 'a'.repeat(40);
export const earlier = 'c'.repeat(40);
export const imageSha = 'b'.repeat(64);
export const sharedCommit = 'f'.repeat(40);
export const alphaThread = '11111111-1111-4111-8111-111111111111';
export const openedThread = '22222222-2222-4222-8222-222222222222';
export const gammaThread = '33333333-3333-4333-8333-333333333333';

function design(version: string, bytes: number) {
	return {
		version,
		createdAt: '2026-10-11',
		commit: tip,
		generator: 'GPT Image',
		prompt: 'Activity page',
		baseRevision: tip,
		images: [{ state: 'default', viewport: 'desktop', sha256: imageSha, bytes }],
		approval: null
	};
}

function activity(options: Options, bytes: number) {
	const version = options.version ?? null;
	return {
		id: 'page:activity',
		category: 'pages',
		kind: 'page',
		title: `${options.name} activity`,
		summary: `The activity page of ${options.name}.`,
		changed: false,
		planned: Boolean(options.plan),
		hasPlan: Boolean(options.plan),
		lifecycle: null,
		verification: 'unverified',
		verificationNote: 'No verification recorded for this revision.',
		latestVersion: version,
		approvedVersion: null,
		threadCount: 0,
		thumbnail: version
			? { version, sha256: imageSha, state: 'default', viewport: 'desktop' }
			: null,
		contract: { inputs: [], outputs: [], errors: [], hash: 'c'.repeat(64) },
		relationships: [],
		versions: version ? [design(version, bytes)] : [],
		threads: [] as Record<string, unknown>[],
		history: [],
		sources: [],
		size: { available: false, text: 'Not measured' },
		performance: { available: false, text: 'Not measured' }
	};
}

function project(options: Options, bytes: number) {
	const agents = !options.shared;
	const page = activity(options, bytes);
	const button = {
		...page,
		id: 'component:button',
		category: 'components',
		kind: 'component',
		title: `${options.name} button`,
		planned: false,
		hasPlan: false,
		latestVersion: null,
		thumbnail: null,
		versions: [],
		threads: []
	};
	return {
		info: { id: options.id, name: options.name, kind: options.shared ? 'shared' : 'local' },
		branch: options.branch,
		askCapabilities: Boolean(options.askCapabilities),
		capabilities: {
			comments: true,
			agents,
			planning: agents,
			approval: agents,
			source: options.shared ? 'github' : 'local'
		},
		entities: [page, button],
		messages: {} as Record<string, Record<string, unknown>[]>
	};
}

const providers = [
	{
		id: 'codex',
		label: 'Codex CLI',
		available: true,
		reason: null,
		version: 'fixture',
		imageGeneration: true,
		models: [
			{
				id: 'fixture',
				label: 'Fixture model',
				efforts: ['medium'],
				defaultEffort: 'medium',
				isDefault: true
			}
		]
	}
];

export function projectData() {
	const image = Array.from(nativeImageFixture());
	const first = project(
		{ id: alpha, name: 'Alpha', branch: 'feat/alpha', version: 'v002', plan: true },
		image.length
	);
	first.entities[0].threads.push({
		id: alphaThread,
		pin: 1,
		version: 'v002',
		imageSha256: imageSha,
		state: 'default',
		viewport: 'desktop',
		region: { x: 0.1, y: 0.2, width: 0.3, height: 0.2 },
		messageCount: 1
	});
	first.messages[alphaThread] = [
		{
			id: 'alpha-message',
			at: 'Today',
			author: 'user',
			text: 'Alpha: keep the filters on one line.',
			mode: 'plan',
			provider: 'codex',
			model: 'fixture',
			version: 'v002',
			imageSha256: imageSha
		}
	];
	return {
		image,
		providers,
		ids: { tip, earlier, sharedCommit, openedThread, gammaThread },
		projects: [
			first,
			project({ id: beta, name: 'Beta', branch: 'main', askCapabilities: true }, image.length),
			project(
				{ id: gamma, name: 'Gamma', branch: 'main', shared: true, version: 'v001' },
				image.length
			)
		]
	};
}

export type { ProjectData } from './ui-project-data.types';
