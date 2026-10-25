import { installDeploymentFixture } from './ui-deployment-fixture';
export const catalogCategories = [
	'Pages',
	'APIs',
	'Layouts',
	'Components',
	'Helpers',
	'Configs',
	'Services',
	'Models'
];
const hash = 'a'.repeat(40);
const item = {
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
	verificationNote: 'No verification recorded for this planned page.',
	latestVersion: null,
	approvedVersion: null,
	threadCount: 0,
	thumbnail: null,
	contract: { inputs: [], outputs: [], errors: [], hash: null },
	relationships: [],
	versions: [],
	threads: [],
	history: [],
	sources: ['src/activity.svelte'],
	size: { available: false, text: 'Not measured' },
	performance: { available: false, text: 'Not measured' }
};
const snapshot = {
	project: { name: 'Test project', root: '/tmp/disposable-harness' },
	revision: { branch: 'feat/activity', commit: hash, tip: hash, atTip: true },
	branches: [{ name: 'feat/activity', tip: hash, current: true }],
	commits: [
		{ hash, subject: 'Fixture', authoredAt: '2026-10-11' },
		{ hash: 'b'.repeat(40), subject: 'Earlier design', authoredAt: '2026-10-10' }
	],
	entities: [
		item,
		{ ...item, id: 'page:overview', title: 'Overview', hasPlan: false, changed: false }
	],
	writable: true
};
const providers = [
	{
		id: 'codex',
		label: 'Codex CLI',
		available: true,
		reason: null,
		version: 'test',
		imageGeneration: true,
		models: [
			{
				id: 'test-model',
				label: 'Test model',
				efforts: ['medium'],
				defaultEffort: 'medium',
				isDefault: true
			}
		]
	},
	{
		id: 'claude',
		label: 'Claude CLI',
		available: false,
		reason: 'CLI not installed',
		version: null,
		imageGeneration: false,
		models: []
	}
];
const thread = {
	id: 'thread-1',
	pin: 1,
	version: null,
	imageSha256: null,
	state: null,
	viewport: null,
	region: null,
	messageCount: 0
};

function installProject(data: {
	snapshot: typeof snapshot;
	item: typeof item;
	providers: typeof providers;
	thread: typeof thread;
}) {
	const { snapshot, item, providers, thread } = data;
	const hash = snapshot.revision.tip;
	const calls: unknown[] = [];
	const bridge = {
		openProject: async () => snapshot,
		snapshot: async (query: { commit: string | null }) => ({
			...snapshot,
			writable: !query.commit,
			revision: {
				...snapshot.revision,
				commit: query.commit || hash,
				atTip: !query.commit || query.commit === hash
			}
		}),
		entity: async () => item,
		source: async () => ({ path: 'src/activity.svelte', text: '<h1>Activity</h1>' }),
		image: async () => new Uint8Array(),
		createPlan: async (draft: unknown) => {
			calls.push(draft);
			return item;
		},
		openThread: async (input: unknown) => {
			calls.push(input);
			return thread;
		},
		messages: async () => [],
		approve: async () => {
			throw Error('No design');
		},
		providers: async () => providers,
		startRun: async (input: unknown) => {
			calls.push(input);
			return { runId: 'owned-run' };
		},
		cancelRun: async () => true,
		onRunEvent: () => () => {}
	};
	Object.assign(window, { harness: bridge, __calls: calls });
}

export async function fakeProject(page: import('@playwright/test').Page, identified = false) {
	const shown = identified
		? { ...snapshot, project: { ...snapshot.project, id: 'local-' + 'a'.repeat(64) } }
		: snapshot;
	await page.addInitScript(installProject, { snapshot: shown, item, providers, thread });
	await installDeploymentFixture(page);
}
