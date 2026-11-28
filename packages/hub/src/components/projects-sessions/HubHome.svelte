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
	import type {
		HomeChatReceipt,
		HomeSection
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { onMount, tick } from 'svelte';
	import { browserContext } from '../../utils/development-tooling/browserContext';
	import { watchWhileVisible } from '../../routes/tracker-overview/overviewClient';
	import { homeSnapshot } from './hubHomeClient';
	import { hubHomeReads } from './hubHomeReads';
	import { provideHubSpecDocuments } from '$reports/components/projects-sessions/hub-home/hubSpecDocument';
	import { provideHomeCosChat } from '$reports/components/projects-sessions/hub-home/hubHomeChatContext.svelte';
	import type { LinkedHome } from '../../services/networking-security/LinkedHomeService';
	import { listedHomeSnapshot } from '$reports/lib/projects-sessions/hub-home/homeDirectAgents';
	import * as presentation from '$reports/components/projects-sessions/hub-home/hubHomePresentation';
	import type * as Home from '$reports/components/projects-sessions/hub-home/hubHomeView.types';
	import type { RealtimeState } from '$reports/lib/projects-sessions/realtime/realtime.types';
	import { followHubUpdates, liveReadMs } from '../../lib/networking-security/hubLiveUpdates';
	import HubHomeHeader from '$reports/components/projects-sessions/hub-home/HubHomeHeader.svelte';
	import AccountMenu from '../accounts-access/AccountMenu.svelte';
	import HubHomeNotifications from './HubHomeNotifications.svelte';
	import HubHomeCards from '$reports/components/projects-sessions/hub-home/HubHomeCards.svelte';
	import HubHomeLive from '$reports/components/projects-sessions/hub-home/HubHomeLive.svelte';
	import HubHomeDialogs from '$reports/components/projects-sessions/hub-home/HubHomeDialogs.svelte';
	import { followNeedsLink } from './followNeedsLink.svelte';
	import { homeDownloadConfig } from '../../configs/public-site/homeDownloadConfig';
	import '$reports/lib/styles/home-scheme.css';
	import '$reports/lib/styles/hub-home/index.css';
	const { api, session, projects } = browserContext();
	const needsOnly = $derived(page.url.searchParams.get('view') === 'needs-you');
	const cosChat = provideHomeCosChat(() => reads.read());
	let selected = $state<HomeSection | null>(null);
	let agentId = $state<string | undefined>();
	let list = $state<ProjectSummary[] | null>(null);
	let projectSnapshots = $state<Record<string, ProjectSnapshot>>({});
	const projectFlights = new SvelteMap<string, Promise<ProjectSnapshot>>();
	let projectError = $state(false);
	let home = $state<Home.ReadHomeResult | null>(null);
	let live = $state<LinkedHome | null>(null);
	let now = $state(Date.now());
	let flight = 0;
	let opener: HTMLElement | null = null;
	let link = $state<RealtimeState | null>(null);
	let readAllAt = 0;
	const pushes = $derived(Boolean(home?.granted && home.live));
	const controlled = $derived(home?.controlled ?? []);
	const raw = $derived(live?.snapshot ?? homeSnapshot(home));
	const snapshot = $derived(raw ? listedHomeSnapshot(raw, controlled) : null);
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
	const reads = hubHomeReads({
		api,
		actor: () => session.actor?.id,
		home: (result) => ((home = result), (now = Date.now())),
		linked: (result) => ((live = result), (now = Date.now()))
	});
	provideHubSpecDocuments(reads.readDocument);
	function refresh() {
		const actor = session.actor?.id;
		const request = ++flight;
		now = readAllAt = Date.now();
		reads.read();
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
	$effect(() => {
		if (!pushes) return;
		const stop = followHubUpdates({
			changed: () => ((now = Date.now()), reads.read()),
			state: (state) => (link = state)
		});
		return () => {
			stop();
			link = null;
		};
	});
	onMount(() => {
		refresh();
		const stop = watchWhileVisible(() => {
			const pushed = link === 'live' && Date.now() - readAllAt < liveReadMs;
			const actor = session.actor?.id;
			void session.check().then(() => {
				// Change notices cover the stored Home only: linked computers are asked every turn.
				if (actor && session.actor?.id === actor) (pushed ? reads.computers : refresh)();
			});
		});
		return () => {
			flight++;
			reads.close();
			stop();
		};
	});
	followNeedsLink(() => {
		const dialog = selected !== null;
		return { asks: view.openAsks, openAsk: cosChat.openAsk, close, dialog, reload: refresh };
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
		if (home) home = { ...home, controlled: result.controlled };
		refresh();
	}
	const receipt = (id: string) => api.get<HomeChatReceipt>('/api/hub-home/chat', { id });
</script>

<hx-div class="home-scheme">
	<hx-div class="home-page hh-home">
		<HubHomeHeader {view} {link} {needsOnly} accountName={session.actor?.name}>
			{#snippet accountMenu()}<AccountMenu />{/snippet}
			{#snippet notifications()}<HubHomeNotifications />{/snippet}
		</HubHomeHeader>
		{#if link === 'live'}
			<hx-p class="po-page hh-page hh-live" role="status" aria-label="Updates" data-state={link}>
				Live
			</hx-p>
		{/if}
		<hx-main class="po-page hh-page" data-harness-component="hub-home" aria-labelledby="hh-title">
			<HubHomeCards {view} {open} send={reads.send} {receipt} {needsOnly} />
			{#if !needsOnly}<HubHomeLive reading={live} {now} {pastDue} />{/if}
		</hx-main>
		{#if selected}
			<HubHomeDialogs
				{selected}
				{view}
				{agentId}
				{open}
				send={reads.send}
				{changeSession}
				{receipt}
				{readProject}
				reload={refresh}
				{close}
			/>
		{/if}
	</hx-div>
</hx-div>
