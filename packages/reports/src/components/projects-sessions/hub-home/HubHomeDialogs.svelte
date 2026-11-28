<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_6kpzjxqlbp -->
<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import Modal from '$reports/components/Modal.svelte';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import ProjectOverview from '$reports/components/projects-sessions/project-overview/ProjectOverview.svelte';
	import HarnessIcon from '$reports/components/explorer-ui/HarnessIcon.svelte';
	import type {
		HomeChatReceipt,
		HomeSection
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { MediaQuery } from 'svelte/reactivity';
	import { sections, workSummary, count, quotaSummary } from './hubHomePresentation';
	import { projectInventory } from './hubHomeProjects';
	import type {
		HomeView,
		OpenHomeSection,
		ChangeSession,
		ReadHomeProject,
		SendHomeChat
	} from './hubHomeView.types';
	import HubHomeAgents from './HubHomeAgents.svelte';
	import HubHomePlanDetail from './HubHomePlanDetail.svelte';
	import HubHomePlans from './HubHomePlans.svelte';
	import HubHomeSchedule from './HubHomeSchedule.svelte';
	import HubHomeProjects from './HubHomeProjects.svelte';
	import HubHomeDirectory from './HubHomeDirectory.svelte';
	import HubHomeQuota from './HubHomeQuota.svelte';
	import HubHomeWork from './HubHomeWork.svelte';
	let {
		selected,
		view,
		agentId,
		open,
		send,
		changeSession,
		receipt,
		readProject,
		reload,
		close
	}: {
		selected: HomeSection;
		view: HomeView;
		agentId?: string;
		open: OpenHomeSection;
		send: SendHomeChat;
		changeSession?: ChangeSession;
		receipt: (id: string) => Promise<HomeChatReceipt>;
		readProject?: ReadHomeProject;
		reload: () => void;
		close: () => void;
	} = $props();
	let chatOpen = $derived(Boolean(agentId));
	let chatName = $state('');
	const phone = new MediaQuery('max-width: 560px');
	const chatStep = $derived(selected === 'agents' && chatOpen && phone.current && chatName);
	const plans = $derived(view.plans ?? []);
	let openedPlan = $state<{ id: string; trigger: HTMLElement } | null>(null);
	const directPlan = $derived(
		selected === 'plans' ? plans.find((plan) => plan.id === agentId) : undefined
	);
	const activePlan = $derived(plans.find((plan) => plan.id === openedPlan?.id));

	function closePlan() {
		const opener = openedPlan?.trigger;
		openedPlan = null;
		void tick().then(() => opener?.focus());
	}
	const runs = $derived(view.schedule ?? []);
	const projects = $derived(view.projects ?? []);
	const snapshots = $derived(projects.map((project) => view.projectSnapshots[project.id]));
	const projectsSummary = $derived.by(() => {
		if (view.native) return 'Projects from Tracker, Hub and this Mac';
		if (view.trackerProjects) return count(view.trackerProjects.projects.length, 'Tracker project');
		if (view.projectsFailed) return 'Shared projects unavailable';
		if (view.projects === null) return 'Loading projects…';
		const result = count(projects.length, 'project');
		if (snapshots.some((snapshot) => !snapshot)) return result;
		const apps = snapshots.reduce(
			(total, snapshot) => total + projectInventory(snapshot).apps.length,
			0
		);
		return `${result} · ${count(apps, 'app')}`;
	});
	const summary = $derived(
		{
			agents:
				view.agents === null
					? 'Loading agents…'
					: view.overview?.status === 'ready'
						? `${count(view.overview.liveSessions, 'live session')} across Tracker`
						: 'Tracker session count unavailable',
			plans:
				view.plans === null
					? 'Loading plans…'
					: `${plans.filter((plan) => plan.state !== 'done').length} open · ${plans.filter((plan) => plan.state === 'done').length} done`,
			scheduled:
				view.schedule === null
					? 'Loading schedule…'
					: `${runs.length} upcoming · ${runs.filter((run) => run.recurring).length} repeating`,
			projects: projectsSummary,
			wip: view.trackerConnected ? workSummary(view.work) : 'Tracker work',
			quota: view.quota === null ? 'Reading usage…' : quotaSummary(view.quota, view.now)
		}[selected]
	);
</script>

{#if directPlan}
	<HubHomePlanDetail plan={directPlan} {close} mac={Boolean(view.native)} />
{:else}
	<Modal
		isOpen
		title={chatStep ? chatName : sections[selected].title}
		summary={chatStep ? 'Chat · replies go to its current Tracker item' : summary}
		variant="section"
		onClose={close}
	>
		{#snippet actions()}
			{#if selected === 'agents' && chatOpen}
				<hx-button
					class="hh-icon-button hh-back"
					type="button"
					aria-label="Back to agents"
					onclick={() => (chatOpen = false)}
				>
					<HarnessIcon name="arrow-left" size={18} />
				</hx-button>
			{:else if selected === 'projects' && view.trackerProjects && !view.native}
				<hx-a class="po-action" href={resolve('/tracker-overview' as '/')}
					>Open Project Overview</hx-a
				>
			{:else if selected === 'projects' && !view.projectsFailed && !view.native}
				<hx-a class="po-action hh-primary" href={resolve('/projects' as '/')}>Manage projects</hx-a>
			{/if}
		{/snippet}
		{#key selected}
			{#if selected === 'agents'}
				<HubHomeAgents
					agents={view.agents}
					added={view.controlled}
					{changeSession}
					{agentId}
					{send}
					{receipt}
					bind:chatOpen
					bind:chatName
				/>
			{:else if selected === 'plans'}
				<HubHomePlans
					plans={view.plans}
					agents={view.agents ?? []}
					discuss={(id) => open('agents', id)}
					openPlan={(id, trigger) => (openedPlan = { id, trigger })}
				/>
			{:else if selected === 'scheduled'}
				<HubHomeSchedule runs={view.schedule} now={view.now} />
			{:else if selected === 'projects'}
				{#if view.native || view.projectDirectory !== undefined}
					<HubHomeDirectory {view} />
				{/if}
				{#if !view.native && view.trackerProjects && view.projectDirectory === undefined}
					<hx-div class="hh-overview"
						><ProjectOverview snapshot={view.trackerProjects} standalone={false} /></hx-div
					>
				{:else if !view.native && view.projectsFailed && view.projectDirectory === undefined}
					<EmptyState as="div" className="po-empty hh-empty">
						<hx-p>Shared projects could not be read.</hx-p>
						<hx-button type="button" class="po-action" onclick={reload}>Try again</hx-button>
					</EmptyState>
				{:else if !view.native && readProject && (view.projectDirectory === undefined || view.projects?.length)}
					<HubHomeProjects
						projects={view.projects}
						snapshots={view.projectSnapshots}
						{readProject}
					/>
				{/if}
			{:else if selected === 'quota'}
				<HubHomeQuota quota={view.quota} now={view.now} connected={view.quotaConnected} {reload} />
			{:else}
				<HubHomeWork
					overview={view.overview}
					work={view.work}
					pastDue={view.pastDue}
					now={view.now}
				/>
			{/if}
		{/key}
	</Modal>
	{#if selected === 'plans' && activePlan}
		<HubHomePlanDetail plan={activePlan} close={closePlan} mac={Boolean(view.native)} />
	{/if}
{/if}
