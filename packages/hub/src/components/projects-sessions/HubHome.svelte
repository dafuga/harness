<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_mqkhzvyhou -->
<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import type { ProjectSummary } from 'collaboration';
	import type { ProjectSnapshot } from '../../../../desktop/src/models/development-tooling/Desktop.types';
	import type {
		HomeChatInput,
		HomeChatReceipt,
		HomeSection
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { onMount, tick } from 'svelte';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import { watchWhileVisible } from '../../routes/tracker-overview/overviewClient';
	import { homeSnapshot, readHome } from './hubHomeClient';
	import { soonestWork } from './hubHomePresentation';
	import type { HomeView, ReadHomeResult } from './hubHomeView.types';
	import HubHomeHeader from './HubHomeHeader.svelte';
	import HubHomeCards from './HubHomeCards.svelte';
	import HubHomeDialogs from './HubHomeDialogs.svelte';
	import '../../lib/styles/home-scheme.css';
	import '../../lib/styles/hub-home/index.css';

	const { api, session, projects } = browserContext();
	let selected = $state<HomeSection | null>(null);
	let agentId = $state<string | undefined>();
	let list = $state<ProjectSummary[] | null>(null);
	let projectSnapshots = $state<Record<string, ProjectSnapshot>>({});
	const projectFlights = new SvelteMap<string, Promise<ProjectSnapshot>>();
	let projectError = $state(false);
	let home = $state<ReadHomeResult | null>(null);
	let now = $state(Date.now());
	let flight = 0;
	let opener: HTMLElement | null = null;
	const snapshot = $derived(homeSnapshot(home));
	const overview = $derived(
		snapshot?.overview ?? (home ? { status: 'unavailable' as const } : null)
	);
	const view: HomeView = $derived({
		overview,
		agents: snapshot?.agents ?? (home ? [] : null),
		plans: snapshot?.plans ?? (home ? [] : null),
		schedule: snapshot?.scheduled ?? (home ? [] : null),
		quota: snapshot?.providers.quota ?? (home ? [] : null),
		projects: list,
		projectSnapshots,
		work: soonestWork(overview),
		owner: home?.granted ?? false,
		trackerConnected: overview?.status === 'ready',
		routinesConnected: Array.isArray(snapshot?.providers.routines),
		quotaConnected: Array.isArray(snapshot?.providers.quota),
		now
	});

	function refresh() {
		const actor = session.actor?.id;
		const request = ++flight;
		now = Date.now();
		void readHome(api).then((result) => {
			if (request === flight && actor === session.actor?.id) home = result;
		});
		void projects.list().then(
			(value) => {
				if (request === flight && actor === session.actor?.id) {
					list = value;
					projectError = false;
					for (const project of value.slice(0, 4)) void readProject(project.id).catch(() => {});
				}
			},
			() => {
				if (request === flight && actor === session.actor?.id) projectError = true;
			}
		);
	}

	onMount(() => {
		refresh();
		const stop = watchWhileVisible(() => {
			const actor = session.actor?.id;
			void session.check().then(() => {
				if (actor && session.actor?.id === actor) refresh();
			});
		});
		return () => {
			flight++;
			stop();
		};
	});

	function open(section: HomeSection, id?: string) {
		if (!selected)
			opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		agentId = id;
		selected = section;
	}

	function close() {
		const target = opener;
		selected = null;
		opener = null;
		void tick().then(() => target?.focus());
	}

	function readProject(id: string) {
		const active = projectFlights.get(id);
		if (active) return active;
		const actor = session.actor?.id;
		const request = api
			.get<ProjectSnapshot>(`/api/projects/${encodeURIComponent(id)}/snapshot`)
			.then((snapshot) => {
				if (actor === session.actor?.id) projectSnapshots = { ...projectSnapshots, [id]: snapshot };
				return snapshot;
			})
			.finally(() => projectFlights.delete(id));
		projectFlights.set(id, request);
		return request;
	}

	function send(message: HomeChatInput) {
		return api.send<HomeChatReceipt>('POST', '/api/hub-home/chat', message);
	}

	function receipt(id: string) {
		return api.get<HomeChatReceipt>('/api/hub-home/chat', { id });
	}
</script>

<hx-div class="home-scheme">
	<hx-div class="home-page hh-home">
		<HubHomeHeader {view} />
		<hx-main class="po-page hh-page" data-harness-component="hub-home" aria-labelledby="hh-title">
			{#if projectError}
				<hx-p class="po-notice" role="status"
					>Shared projects could not be read. Home will try again while it is open.</hx-p
				>
			{/if}
			<HubHomeCards {view} {open} {send} />
		</hx-main>
		{#if selected}
			<HubHomeDialogs
				{selected}
				{view}
				{agentId}
				{open}
				{send}
				{receipt}
				{readProject}
				reload={refresh}
				{close}
			/>
		{/if}
	</hx-div>
</hx-div>
