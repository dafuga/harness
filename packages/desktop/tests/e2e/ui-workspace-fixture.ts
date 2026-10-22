import { expect, type Page } from '../../../../test/support/browserTest';
import { workflowWorkload } from './page-workload';
import { installDeploymentFixture } from './ui-deployment-fixture';
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

const rootUnits = ['desktop.page.root', 'desktop.layout.root', 'desktop.entry.app-html'];

export async function readOnlyStart(page: Page) {
	await workflowWorkload(page, { units: rootUnits, name: 'read-only-start' }, async () => {
		await page.goto('/');
		await expect(page.getByRole('button', { name: 'Open Project', exact: true })).toBeDisabled();
		await expect(page.getByText(/Browser preview · read-only/)).toBeVisible();
	});
}

export async function openProjectCatalog(page: Page) {
	await workflowWorkload(
		page,
		{
			units: [...rootUnits, 'desktop.component.workspace-shell'],
			name: 'open-project-catalog'
		},
		async () => {
			await page.goto('/');
			await page.getByRole('button', { name: 'Open Project', exact: true }).click();
			await expect(
				page.getByRole('navigation', { name: 'Catalog categories' }).getByRole('link')
			).toHaveCount(7);
		}
	);
}

export async function openLegacyWorkspace(page: Page) {
	await workflowWorkload(
		page,
		{
			units: [...rootUnits, 'desktop.page.harness-path', 'desktop.component.workspace-shell'],
			name: 'legacy-workspace-open'
		},
		async () => {
			await page.goto('/harness/branch/feat%2Factivity/pages');
			const open = page.getByRole('button', { name: 'Open Project', exact: true });
			const categories = page.getByRole('navigation', { name: 'Catalog categories' });
			await expect
				.poll(async () => (await open.isVisible()) || (await categories.isVisible()))
				.toBe(true);
			if (await open.isVisible()) await open.click();
			await expect(categories.getByRole('link')).toHaveCount(7);
		}
	);
}

export async function previewScreenshot(page: Page) {
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.waitForFunction(() => Boolean(document.querySelector('h1')));
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({ path: 'test-results/ui-preview.png', fullPage: true });
	}
}

export async function planScreenshot(page: Page) {
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
		});
		await page.screenshot({ path: 'test-results/ui-initial-plan.png', fullPage: true });
	}
}
