<script lang="ts">
	import type { Component as SvelteComponent } from 'svelte';
	import type { ProjectSnapshot } from '../../../../../desktop/src/models/development-tooling/Desktop.types';
	import type { ProjectSummary } from 'collaboration';
	import type { SendHomeChat } from '../../../../../hub/src/components/projects-sessions/hubHomeView.types';
	import HubHomeRow from '../../../../../hub/src/components/projects-sessions/HubHomeRow.svelte';
	import { browserContext } from '../../../../../hub/src/utils/development-tooling/browserContext';
	import { catalogHomeView } from './hubHomeCatalogData';
	import '../../../../../hub/src/lib/styles/home-scheme.css';
	import '../../../../../hub/src/lib/styles/hub-home/index.css';

	let { id, Component }: { id: string; Component: SvelteComponent<Record<string, unknown>> } =
		$props();

	const { api, projects } = browserContext();
	let list = $state<ProjectSummary[]>([]);
	let snapshots = $state<Record<string, ProjectSnapshot>>({});
	const view = $derived({ ...catalogHomeView, projects: list, projectSnapshots: snapshots });
	const name = $derived(id.replace('hub.component.projects-sessions-hub-', ''));
	const noop = () => {};
	const send: SendHomeChat = async ({ id }) => ({ id, status: 'sent' });
	const receipt = async (id: string) => ({ id, status: 'sent' as const });

	async function readProject(id: string) {
		return api.get<ProjectSnapshot>(`/api/projects/${encodeURIComponent(id)}/snapshot`);
	}

	const ready = projects.list().then(async (items) => {
		list = items;
		const entries = await Promise.all(list.map(async ({ id }) => [id, await readProject(id)]));
		snapshots = Object.fromEntries(entries);
	});

	const fixtureProps = $derived<Record<string, Record<string, unknown>>>({
		'home-agents': { agents: view.agents, send, receipt },
		'home-cards': { view, open: noop, send },
		'home-composer': { agents: view.agents, send },
		'home-dialogs': {
			selected: 'plans',
			view,
			open: noop,
			send,
			receipt,
			readProject,
			reload: noop,
			close: noop
		},
		'home-header': { view },
		'home-plans': { plans: view.plans, agents: view.agents, discuss: noop },
		'home-projects': { projects: list, snapshots, readProject },
		'home-quota': { quota: view.quota, now: view.now, connected: true, reload: noop },
		'home-row': { title: 'Review the export columns', meta: 'Atlas · 2h ago' },
		'home-schedule': { runs: view.schedule, now: view.now, connected: true },
		'home-skeleton': { rows: 3 },
		'home-work': { overview: view.overview, work: view.work, now: view.now },
		'home-work-cards': { view, open: noop },
		'quota-subscription': {
			subscription: view.quota?.[0],
			now: view.now,
			detailed: true,
			reload: noop
		}
	});
</script>

{#if name === 'home'}
	<Component />
{:else}
	{#await ready then}
		<div class="home-scheme">
			<div class="hh-home" data-catalog-home-part>
				{#if name === 'home-card'}
					<Component section="plans" total={1} summary="1 in progress" open={noop}>
						<HubHomeRow title="Prepare the export cutover" meta="Atlas" />
					</Component>
				{:else}
					<Component {...fixtureProps[name]} />
				{/if}
			</div>
		</div>
	{/await}
{/if}
