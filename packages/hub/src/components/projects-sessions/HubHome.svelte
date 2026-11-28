<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_mqkhzvyhou -->
<!-- @harness-view overview -->
<script lang="ts">
	import { page } from '$app/state';
	import { workOverview } from '$reports/components/projects-sessions/hub-home/hubHomeStatusText';
	import { homeBoard } from '$reports/components/projects-sessions/hub-home/hubHomeMerge';
	import { SvelteMap } from 'svelte/reactivity';
	import type { ProjectSummary } from 'collaboration';
	import type { ProjectSnapshot } from '../../../../desktop/src/models/development-tooling/Desktop.types';
	import type { HomeSection } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { onMount, tick } from 'svelte';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import { homeSnapshot } from './hubHomeClient';
	import { hubHomeSource } from './hubHomeSource.svelte';
	import { provideHubSpecDocuments } from '$reports/components/projects-sessions/hub-home/hubSpecDocument';
	import { homeCosChat } from '$reports/components/projects-sessions/hub-home/hubHomeChatContext.svelte';
	import * as presentation from '$reports/components/projects-sessions/hub-home/hubHomePresentation';
	import type * as Home from '$reports/components/projects-sessions/hub-home/hubHomeView.types';
	import HubHomeHeader from '$reports/components/projects-sessions/hub-home/HubHomeHeader.svelte';
	import AccountMenu from '../accounts-access/AccountMenu.svelte';
	import HubHomeNotifications from './HubHomeNotifications.svelte';
	import HubHomeCards from '$reports/components/projects-sessions/hub-home/HubHomeCards.svelte';
	import HubHomeBoard from '$reports/components/projects-sessions/hub-home/HubHomeBoard.svelte';
	import HubHomeDialogs from '$reports/components/projects-sessions/hub-home/HubHomeDialogs.svelte';
	import { followNeedsLink } from './followNeedsLink.svelte';
	import { homeDownloadConfig } from '../../configs/public-site/homeDownloadConfig';
	import '$reports/lib/styles/home-scheme.css';
	import '$reports/lib/styles/hub-home/index.css';
	const { api, session, projects } = browserContext();
	const needsOnly = $derived(page.url.searchParams.get('view') === 'needs-you');
	const source = hubHomeSource();
	const cosChat = homeCosChat()!;
	let selected = $state<HomeSection | null>(null);
	let agentId = $state<string | undefined>();
	let list = $state<ProjectSummary[] | null>(null);
	let projectSnapshots = $state<Record<string, ProjectSnapshot>>({});
	const projectFlights = new SvelteMap<string, Promise<ProjectSnapshot>>();
	let projectError = $state(false);
	let flight = 0;
	let opener: HTMLElement | null = null;
	const home = $derived(source.home);
	const live = $derived(source.live);
	const link = $derived(source.link);
	const now = $derived(source.now);
	const controlled = $derived(source.controlled);
	const snapshot = $derived(source.snapshot);
	const settled = $derived(Boolean(snapshot) || (home !== null && live !== null));
	const routinesConnected = $derived(
		Array.isArray(snapshot?.providers.routines) &&
			!presentation.staleReading(snapshot.providers.routinesReadAt, now)
	);
	const board = $derived(snapshot ? homeBoard(snapshot, routinesConnected, now) : null);
	const pastDue = $derived(board?.pastDue ?? []);
	const unavailable = { status: 'unavailable' } as const;
	const overview = $derived(
		workOverview(snapshot?.overview ?? (settled ? unavailable : null), pastDue)
	);
	const linkedComputers = $derived(live?.linked ?? 0);
	const projectsFailed = $derived(projectError && !list?.length);
	const view: Home.HomeView = $derived({
		overview,
		agents: snapshot?.agents ?? (settled ? [] : null),
		openAsks: snapshot?.openAsks ?? [],
		reminders: snapshot?.reminders ?? null,
		controlled,
		plans: snapshot?.plans ?? (settled ? [] : null),
		schedule: board?.upcoming ?? (settled ? [] : null),
		pastDue,
		quota: snapshot?.providers.quota ?? (settled ? [] : null),
		projects: list,
		projectsFailed,
		projectDirectory: snapshot?.projectDirectory ?? homeSnapshot(home)?.projectDirectory,
		trackerProjects: projectsFailed && overview?.status === 'ready' ? overview : null,
		projectSnapshots,
		work: presentation.soonestWork(overview),
		owner: home?.granted ?? false,
		needsMac: settled && !snapshot && !linkedComputers,
		linkedComputers,
		connectMacHref: homeDownloadConfig.mac.path,
		computers: live,
		trackerConnected: overview?.status === 'ready',
		quotaConnected: Array.isArray(snapshot?.providers.quota),
		providerPreference: snapshot?.providerPreference,
		now
	});
	provideHubSpecDocuments(source.readDocument);
	function listProjects() {
		const actor = session.actor?.id;
		const request = ++flight;
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
		const stop = source.onRefresh(listProjects);
		// A return to Home reads again; on first load that read is already under way.
		if (home) source.reread();
		return () => {
			flight++;
			stop();
		};
	});
	followNeedsLink(() => {
		const dialog = selected !== null;
		return { asks: view.openAsks, openAsk: cosChat.openAsk, close, dialog, reload: source.refresh };
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
	async function changeSession(id: string, add: boolean) {
		const method = add ? 'POST' : 'DELETE';
		const result = await api.send<{ controlled: string[] }>(method, '/api/hub-home/agents', { id });
		source.setControlled(result.controlled);
		source.refresh();
	}
</script>

<hx-div class="home-scheme">
	<hx-div class="home-page hh-home">
		<!-- prettier-ignore -->
		<HubHomeHeader {view} {link} {needsOnly} {open} board={!needsOnly} accountName={session.actor?.name}>
			{#snippet accountMenu()}<AccountMenu />{/snippet}
			{#snippet notifications()}<HubHomeNotifications />{/snippet}
		</HubHomeHeader>
		{#if link === 'live'}
			<hx-p class="po-page hh-page hh-live" role="status" aria-label="Updates" data-state={link}>
				Live
			</hx-p>
		{/if}
		<hx-main class="po-page hh-page" data-harness-component="hub-home" aria-labelledby="hh-title">
			{#if needsOnly}<HubHomeCards
					{view}
					{open}
					send={source.send}
					receipt={source.receipt}
					{needsOnly}
				/>
			{:else}<HubHomeBoard {view} {open} send={source.send} receipt={source.receipt} />{/if}
		</hx-main>
		{#if selected}
			<HubHomeDialogs
				{selected}
				{view}
				{agentId}
				{open}
				send={source.send}
				{changeSession}
				receipt={source.receipt}
				{readProject}
				reload={source.refresh}
				{close}
			/>
		{/if}
	</hx-div>
</hx-div>
