<script lang="ts">
	import type { Component as SvelteComponent } from 'svelte';
	import type { ProjectSnapshot } from '../../../../../desktop/src/models/development-tooling/Desktop.types';
	import type { ProjectSummary } from 'collaboration';
	import type { SendHomeChat } from '../../../../src/components/projects-sessions/hub-home/hubHomeView.types';
	import HubHomeRow from '../../../../src/components/projects-sessions/hub-home/HubHomeRow.svelte';
	import { browserContext } from '../../../../../hub/src/utils/development-tooling/browserContext';
	import { catalogHomeView, catalogWorkProject } from './hubHomeCatalogData';
	import { catalogReminders } from './hubHomeReminderData';
	import { previewAnswerOptions } from './shared';
	import '../../../../src/lib/styles/home-scheme.css';
	import '../../../../src/lib/styles/hub-home/index.css';

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
	const ask = {
		itemId: 'example1',
		agentId: 'cos',
		agentName: 'Chief of Staff',
		title: 'Prepare the export cutover',
		question: 'Which column names should the export keep?',
		options: previewAnswerOptions,
		since: new Date(catalogHomeView.now - 3_600_000).toISOString()
	};

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
		'home-ask': { ask, send, receipt },
		'home-cards': { view, open: noop, send },
		'home-choices': { agent: { options: previewAnswerOptions }, onpick: noop },
		'home-composer': { agents: view.agents, send },
		'home-cos-chat': {
			agent: view.agents?.find((agent) => agent.id === 'cos'),
			now: new Date(view.now).toISOString(),
			send
		},
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
		'home-directory': {
			view: {
				...view,
				projectDirectory: [{ name: 'Atlas', state: 'needs-you', needsYou: 1 }]
			}
		},
		'home-header': { view },
		'home-live': { reading: view.computers, now: view.now },
		'home-live-project': { project: catalogWorkProject, now: view.now },
		'home-needs-you': {
			asks: [ask],
			now: view.now,
			open: noop
		},
		'home-notification-settings': {
			quiet: { enabled: true, start: '22:00', end: '08:00' },
			deliveredAt: view.now - 900_000,
			busy: false,
			failed: '',
			save: noop,
			turnOff: noop,
			close: noop
		},
		'home-notifications': {},
		'home-not-started': {
			pastDue: [
				{
					id: 'example2',
					title: 'Check export compatibility',
					at: new Date(view.now - 7_200_000).toISOString(),
					agent: 'Atlas',
					machine: null,
					source: 'tracker',
					recurring: false,
					state: 'blocked',
					reason: 'Waiting on your answer'
				}
			],
			work: []
		},
		'home-plan-detail': { plan: view.plans?.[0], close: noop },
		'home-plannable': { view, open: noop },
		'home-plans': { plans: view.plans, agents: view.agents, discuss: noop, openPlan: noop },
		'home-project-card': { view, open: noop },
		'home-projects': { projects: list, snapshots, readProject },
		'home-quota': { quota: view.quota, now: view.now, connected: true, reload: noop },
		'home-quota-pills': { subscriptions: view.quota, now: view.now },
		'home-reminder': { reminder: catalogReminders[0], now: view.now, send, receipt },
		'home-reminders': { reminders: catalogReminders, now: view.now, send, receipt },
		'home-row': { title: 'Review the export columns', meta: 'Atlas · 2h ago' },
		'home-schedule': { runs: view.schedule, now: view.now, connected: true },
		'home-skeleton': { rows: 3 },
		'home-work': { overview: view.overview, work: view.work, pastDue: view.pastDue, now: view.now },
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
