import type { Page } from '@playwright/test';
import { projectFixture } from './ui-project-fixture';
export * from './ui-project-fixture';

type Entity = Record<string, unknown>;
/** An entity added to one synthetic project, at both commits or at only one of them. */
export interface Added {
	project: number;
	id: string;
	category: string;
	kind: string;
	title: string;
	summary: string;
	at?: 'tip' | 'earlier';
}
/** Project-owned helpers name component and service callers; some exist at one commit only. */
export const added: Added[] = [
	{
		project: 0,
		id: 'app.shell.order-frame',
		category: 'shells',
		kind: 'shell',
		title: 'Alpha order frame',
		summary: 'Frames the Alpha order pages.'
	},
	{
		project: 0,
		id: 'app.function.format-time',
		category: 'functions',
		kind: 'function',
		title: 'Alpha format time',
		summary: 'Says how long ago an Alpha order was placed.',
		at: 'tip'
	},
	{
		project: 0,
		id: 'app.function.legacy-totals',
		category: 'functions',
		kind: 'function',
		title: 'Alpha legacy totals',
		summary: 'Sums the Alpha orders the old way.',
		at: 'earlier'
	},
	{
		project: 0,
		id: 'app.config.order-limits',
		category: 'configs',
		kind: 'config',
		title: 'Alpha order limits',
		summary: 'How many Alpha orders a page lists.'
	},
	{
		project: 0,
		id: 'app.service.refunds',
		category: 'services',
		kind: 'service',
		title: 'Alpha refund service',
		summary: 'Pays back a refunded Alpha order.'
	},
	{
		project: 1,
		id: 'app.function.beta-only',
		category: 'functions',
		kind: 'function',
		title: 'Beta only function',
		summary: 'Exists in Beta alone.'
	},
	{
		project: 1,
		id: 'app.service.formatting',
		category: 'services',
		kind: 'service',
		title: 'Formatting service',
		summary: 'Uses the shared formatter for display values.'
	}
];

function install(items: Added[]) {
	const host = window as unknown as {
		__projects: {
			data: { ids: { tip: string }; projects: Array<{ entities: Entity[] }> };
			snapshot: (project: unknown, commit?: string | null) => { entities: Entity[] };
		};
	};
	const state = host.__projects;
	for (const item of items) {
		const project = state.data.projects[item.project];
		const base = project.entities.find((entity) => entity.category === 'components');
		if (!base) throw new Error('The synthetic project needs a component consumer.');
		const { project: _project, at = null, ...shown } = item;
		const helperContracts =
			item.category === 'functions'
				? [
						{
							name: item.id.split('.').at(-1),
							pure: true,
							source: `src/functions/${item.id}.ts`,
							inputs: [],
							consumers: [
								{ unit: String(base.id) },
								...items
									.filter(
										(caller) => caller.project === item.project && caller.category === 'services'
									)
									.map((caller) => ({ unit: caller.id }))
							]
						}
					]
				: [];
		project.entities.push({ ...base, ...shown, at, helperContracts, threads: [], versions: [] });
	}
	// Each commit lists only what it holds; every entity can still be opened by its id.
	const read = state.snapshot;
	state.snapshot = (project, commit = null) => {
		const shown = read(project, commit);
		const at = !commit || commit === state.data.ids.tip ? 'tip' : 'earlier';
		return { ...shown, entities: shown.entities.filter((item) => !item.at || item.at === at) };
	};
}

/** The project fixture, local or hosted, with the added entities. */
export async function searchFixture(page: Page, fixture = projectFixture) {
	await fixture(page);
	await page.addInitScript(install, added);
}
