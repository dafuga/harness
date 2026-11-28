<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_qvuoo5oeav -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import Modal from '$reports/components/Modal.svelte';
	import { splitHomeSchedule } from '$reports/lib/projects-sessions/hub-home/homeSchedule';
	import type {
		HomeChatInput,
		HomeSection,
		OwnerHomeSnapshot,
		TrackerHomeSource
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import HubHomeCosChat from '$reports/components/projects-sessions/hub-home/HubHomeCosChat.svelte';
	import HubHomePlannable from '$reports/components/projects-sessions/hub-home/HubHomePlannable.svelte';
	import HubHomePlanDetail from '$reports/components/projects-sessions/hub-home/HubHomePlanDetail.svelte';
	import HubHomeWorkCards from '$reports/components/projects-sessions/hub-home/HubHomeWorkCards.svelte';
	import HubHomeWork from '$reports/components/projects-sessions/hub-home/HubHomeWork.svelte';
	import HubHomeLive from '$reports/components/projects-sessions/hub-home/HubHomeLive.svelte';
	import { soonestWork } from '$reports/components/projects-sessions/hub-home/hubHomePresentation';
	import { workOverview } from '$reports/components/projects-sessions/hub-home/hubHomeStatusText';
	import HubHomePlans from '$reports/components/projects-sessions/hub-home/HubHomePlans.svelte';
	import HubHomeSchedule from '$reports/components/projects-sessions/hub-home/HubHomeSchedule.svelte';
	import { provideHomeCosChat } from '$reports/components/projects-sessions/hub-home/hubHomeChatContext.svelte';
	import '$reports/lib/styles/project-overview.css';
	import '$reports/lib/styles/project-overview-cards.css';
	import '$reports/lib/styles/project-overview-controls.css';
	import '$reports/lib/styles/project-overview-responsive.css';
	import '$reports/lib/styles/home-scheme.css';
	import '$reports/lib/styles/hub-home/index.css';

	let { source, mac, signedIn }: { source: TrackerHomeSource; mac: boolean; signedIn: boolean } =
		$props();
	const chat = provideHomeCosChat(undefined, () => (signedIn ? source.outgoing : undefined));
	let snapshot = $state.raw<OwnerHomeSnapshot | null>(null);
	let unavailable = $state(false);
	let now = $state(Date.now());
	let list = $state<'plans' | 'scheduled' | 'wip' | null>(null);
	let listOpener: HTMLElement | null = null;
	let selection = $state<{ id: string; opener: HTMLElement | null } | null>(null);
	let loading = false;
	const activePlan = $derived(snapshot?.plans.find((plan) => plan.id === selection?.id));
	const board = $derived(snapshot ? splitHomeSchedule(snapshot, now) : null);
	const overview = $derived(
		workOverview(
			snapshot?.overview ?? (unavailable ? { status: 'unavailable' } : null),
			board?.pastDue ?? []
		)
	);
	const view = $derived({
		overview,
		work: soonestWork(overview),
		trackerConnected: overview?.status === 'ready',
		pastDue: board?.pastDue ?? [],
		plans: snapshot?.plans ?? (unavailable ? [] : null),
		schedule: board?.upcoming ?? (unavailable ? [] : null),
		agents: null,
		needsMac: unavailable,
		now
	});

	async function refresh() {
		if (loading) return;
		loading = true;
		try {
			const result = await source.read();
			unavailable = result.overview.status !== 'ready';
			snapshot = unavailable ? null : result;
			now = Date.now();
		} catch {
			unavailable = true;
			if (!chat.target && !list && !selection) snapshot = null;
		} finally {
			loading = false;
		}
	}

	async function send(message: HomeChatInput) {
		const result = await source.send(message);
		void refresh();
		return result;
	}

	onMount(() => {
		void refresh();
		const interval = setInterval(() => {
			if (!document.hidden && (chat.target || Date.now() - now >= 30_000)) void refresh();
		}, 5_000);
		return () => clearInterval(interval);
	});

	function open(section: HomeSection, id?: string) {
		const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		if (section === 'plans' && id) selection = { id, opener: trigger };
		else if (section === 'plans' || section === 'scheduled' || section === 'wip') {
			list = section;
			listOpener = trigger;
		}
	}

	function closePlan() {
		const opener = selection?.opener;
		selection = null;
		void tick().then(() => opener?.focus());
	}

	function closeList() {
		const opener = listOpener;
		list = listOpener = null;
		void tick().then(() => opener?.focus());
	}
</script>

<hx-div class="home-scheme">
	<hx-section
		class="home-page hh-home"
		data-harness-component="tracker-work"
		aria-label="Tracker plans and schedule"
	>
		<hx-div class="po-page hh-page">
			<hx-header class="po-head hh-head">
				<hx-a class="po-home" href={resolve('/')}>Home</hx-a>
				<hx-h1 class="po-title">Plans and schedule</hx-h1>
			</hx-header>
			{#if unavailable}
				<hx-p role="status" class="po-sessions">
					{mac
						? 'Tracker could not be reached on this Mac.'
						: 'Connect to your Mac to read its latest plans and schedule.'}
				</hx-p>
			{/if}
			<hx-div class="hh-grid">
				<HubHomePlannable {view} {open} />
				<HubHomeWorkCards {view} {open} />
			</hx-div>
			{#if snapshot?.liveOverview}<HubHomeLive
					local={snapshot.liveOverview}
					{now}
					pastDue={view.pastDue}
				/>{/if}
		</hx-div>

		{#if list}
			<Modal
				isOpen
				title={{ plans: 'Plans', scheduled: 'Scheduled', wip: 'Work in progress' }[list]}
				variant="section"
				onClose={closeList}
			>
				{#if list === 'plans'}
					<HubHomePlans
						plans={view.plans}
						agents={[]}
						discuss={() => {}}
						openPlan={(id, opener) => (selection = { id, opener })}
					/>
				{:else if list === 'wip'}
					<HubHomeWork {overview} work={view.work} pastDue={view.pastDue} {now} />
				{:else}
					<HubHomeSchedule runs={view.schedule} {now} />
				{/if}
			</Modal>
		{/if}
		{#if activePlan}<HubHomePlanDetail plan={activePlan} close={closePlan} {mac} />{/if}
		<HubHomeCosChat
			agent={snapshot?.agents.find((agent) => agent.id === 'cos')}
			now={new Date(now).toISOString()}
			{send}
			showCard={signedIn && Boolean(source.outgoing)}
		/>
	</hx-section>
</hx-div>
