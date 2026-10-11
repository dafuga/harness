import { expect, test } from '@playwright/test';

test('browser preview exposes no writable backend', async ({ page }) => {
	await page.goto('/');
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.waitForFunction(() => Boolean(document.querySelector('h1')));
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({ path: 'test-results/ui-preview.png', fullPage: true });
	}
	await expect(page.getByRole('button', { name: 'Open Project', exact: true })).toBeDisabled();
	await expect(page.getByText(/Browser preview · read-only/)).toBeVisible();
});

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
			revision: { ...snapshot.revision, commit: query.commit || hash, atTip: !query.commit }
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

async function fakeProject(page: import('@playwright/test').Page) {
	await page.addInitScript(installProject, { snapshot, item, providers, thread });
}

test('designless Plan preserves truthful status and branch/commit paths', async ({ page }) => {
	await fakeProject(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await expect(
		page.getByRole('navigation', { name: 'Catalog categories' }).getByRole('link')
	).toHaveCount(5);
	await expect(page.getByRole('link', { name: 'Review designs' })).toHaveAttribute(
		'href',
		'/harness/branch/feat%2Factivity/pages/page%3Aactivity'
	);
	await page.getByRole('link', { name: 'Review designs' }).click();
	if (process.env.TAKE_SCREENSHOT === 'true') {
		await page.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
		});
		await page.screenshot({ path: 'test-results/ui-initial-plan.png', fullPage: true });
	}
	await expect(page).toHaveURL(/branch\/feat%2Factivity\/pages\/page%3Aactivity$/);
	await expect(page.getByRole('heading', { name: 'No design image yet' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Change', exact: true })).toBeDisabled();
	await expect(page.getByRole('button', { name: 'Claude CLI', exact: true })).toBeDisabled();
	await expect(page.getByText('src/activity.svelte', { exact: true })).toHaveCount(0);
	await page
		.getByRole('textbox', { name: 'Message', exact: true })
		.fill('Create the first Activity design');
	await page.getByRole('button', { name: 'Send plan', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => JSON.stringify((window as unknown as { __calls: unknown[] }).__calls))
		)
		.toContain('Create the first Activity design');
	await page.getByLabel('Commit', { exact: true }).selectOption('b'.repeat(40));
	await expect(page).toHaveURL(/branch\/feat%2Factivity\/commit\/b{40}\/pages/);
	await expect(page.getByRole('button', { name: 'New page' })).toBeDisabled();
	await expect(page.getByRole('link', { name: 'Review designs' })).toHaveAttribute(
		'href',
		`/harness/branch/feat%2Factivity/commit/${'b'.repeat(40)}/pages/page%3Aactivity`
	);
	await expect(
		page
			.getByRole('navigation', { name: 'Catalog categories' })
			.getByRole('link', { name: 'Components', exact: true })
	).toHaveAttribute('href', `/harness/branch/feat%2Factivity/commit/${'b'.repeat(40)}/components`);
});

test('catalog search, changed filter and new plan draft', async ({ page }) => {
	await fakeProject(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
	await page.getByRole('checkbox', { name: 'Changed only', exact: true }).check();
	await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toHaveCount(0);
	await page.getByRole('textbox', { name: 'Search pages', exact: true }).fill('missing');
	await expect(page.getByText('No pages match this view.')).toBeVisible();
	await page.getByRole('button', { name: 'New page' }).click();
	await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Activity');
	await page.getByRole('textbox', { name: 'Goal', exact: true }).fill('Make work visible');
	await page.getByRole('button', { name: 'Create plan', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => JSON.stringify((window as unknown as { __calls: unknown[] }).__calls))
		)
		.toContain('Make work visible');
	await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
});
