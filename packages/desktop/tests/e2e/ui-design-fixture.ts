import type { Page } from '@playwright/test';
import { nativeImageFixture } from './native-image-fixture';
const hash = 'a'.repeat(40),
	sha = 'b'.repeat(64);
const entity = {
	id: 'page:activity',
	category: 'pages',
	kind: 'page',
	title: 'Activity',
	summary: 'A searchable timeline of project work.',
	planned: true,
	hasPlan: true,
	changed: true,
	lifecycle: null,
	verification: 'unverified',
	verificationNote: 'Planned page. No implementation verification recorded.',
	latestVersion: 'v002',
	approvedVersion: null,
	threadCount: 1,
	thumbnail: { version: 'v002', sha256: sha, state: 'default', viewport: 'desktop' },
	contract: {
		inputs: [{ name: 'events', type: 'ActivityEvent[]' }],
		outputs: [{ name: 'selection', type: 'ActivityEvent' }],
		errors: [],
		hash: 'c'.repeat(64)
	},
	relationships: [],
	threads: [
		{
			id: 'thread-1',
			pin: 1,
			version: 'v002',
			imageSha256: sha,
			state: 'default',
			viewport: 'desktop',
			region: { x: 0.1, y: 0.2, width: 0.4, height: 0.2 },
			messageCount: 1
		}
	],
	history: [
		{
			id: 'event-1',
			at: '2026-10-11',
			kind: 'design',
			title: 'Activity v002 committed',
			detail: 'Compact filters',
			commit: hash,
			version: 'v002'
		}
	],
	sources: ['src/activity.svelte'],
	size: { available: false, text: 'Not measured — planned page' },
	performance: { available: false, text: 'Not measured — planned page' }
};
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
const messages = [
	{
		id: 'message-1',
		at: 'Today',
		author: 'user',
		text: 'Keep the filters on one line.',
		mode: 'plan',
		provider: 'codex',
		model: 'fixture',
		version: 'v002',
		imageSha256: sha
	}
];
const stream = { runId: 'run-owned', kind: 'text', text: 'Working on the approved design.' };

function fixtureData(image: number[], headless: boolean) {
	const design = {
		version: 'v002',
		createdAt: '2026-10-11',
		commit: hash,
		generator: 'GPT Image',
		prompt: 'Activity page',
		baseRevision: hash,
		images: headless
			? []
			: [{ state: 'default', viewport: 'desktop', sha256: sha, bytes: image.length }],
		notes: headless
			? 'Validate each event before saving it. Return a typed error when the input is invalid.'
			: undefined,
		approval: null as unknown
	};
	const detailedEntity = {
		...entity,
		category: headless ? 'services' : 'pages',
		kind: headless ? 'service' : 'page',
		versions: [design]
	};
	const snapshot = {
		project: { name: 'Harness fixture', root: '/tmp/fixture' },
		revision: { branch: 'feat/activity', commit: hash, tip: hash, atTip: true },
		branches: [{ name: 'feat/activity', tip: hash, current: true }],
		commits: [{ hash, subject: 'Design committed', authoredAt: '2026-10-11' }],
		entities: [detailedEntity],
		writable: true
	};
	return { image, entity: detailedEntity, snapshot, providers, messages, stream };
}

function installFixture({
	image,
	entity,
	snapshot,
	providers,
	messages,
	stream
}: ReturnType<typeof fixtureData>) {
	const calls: Record<string, unknown>[] = [];
	let listener: (event: unknown) => void = () => {};
	Object.assign(window, {
		__calls: calls,
		harness: {
			openProject: async () => snapshot,
			snapshot: async () => snapshot,
			entity: async () => entity,
			image: async () => new Uint8Array(image),
			source: async () => ({ path: 'src/activity.svelte', text: '<h1>Activity</h1>' }),
			createPlan: async () => entity,
			openThread: async (input: Record<string, unknown>) => {
				calls.push({ action: 'thread', ...input });
				return { ...entity.threads[0], ...input };
			},
			messages: async () => messages,
			approve: async (input: Record<string, unknown>) => {
				calls.push({ action: 'approve', ...input });
				entity.versions[0].approval = {
					...input,
					id: 'approval-1',
					approvedAt: 'Today',
					current: true
				};
				return entity.versions[0].approval;
			},
			providers: async () => providers,
			startRun: async (input: Record<string, unknown>) => {
				calls.push({ action: 'run', ...input });
				setTimeout(() => listener(stream), 20);
				return { runId: 'run-owned' };
			},
			cancelRun: async (input: Record<string, unknown>) => {
				calls.push({ action: 'cancel', ...input });
				listener({ runId: 'run-owned', kind: 'cancelled' });
				return true;
			},
			onRunEvent: (callback: (event: unknown) => void) => {
				listener = callback;
				return () => {};
			}
		}
	});
}

export async function fixture(page: Page, headless = false) {
	const image = Array.from(nativeImageFixture());
	await page.addInitScript(installFixture, fixtureData(image, headless));
}
