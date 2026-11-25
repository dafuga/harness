<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_6kpzjxqlbp -->
<script lang="ts">
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
	import { sections, workSummary, count, quotaSummary, isWorking } from './hubHomePresentation';
	import { projectInventory } from './hubHomeProjects';
	import type {
		HomeView,
		OpenHomeSection,
		ReadHomeProject,
		SendHomeChat
	} from './hubHomeView.types';
	import HubHomeAgents from './HubHomeAgents.svelte';
	import HubHomePlans from './HubHomePlans.svelte';
	import HubHomeSchedule from './HubHomeSchedule.svelte';
	import HubHomeProjects from './HubHomeProjects.svelte';
	import HubHomeQuota from './HubHomeQuota.svelte';
	import HubHomeWork from './HubHomeWork.svelte';
	let {
		selected,
		view,
		agentId,
		open,
		send,
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
		receipt: (id: string) => Promise<HomeChatReceipt>;
		readProject: ReadHomeProject;
		reload: () => void;
		close: () => void;
	} = $props();
	let chatOpen = $derived(Boolean(agentId));
	let chatName = $state('');
	const phone = new MediaQuery('max-width: 560px');
	const chatStep = $derived(selected === 'agents' && chatOpen && phone.current && chatName);
	const plans = $derived(view.plans ?? []);
	const runs = $derived(view.schedule ?? []);
	const projects = $derived(view.projects ?? []);
	const snapshots = $derived(projects.map((project) => view.projectSnapshots[project.id]));
	const projectsSummary = $derived.by(() => {
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
					: `${view.agents.filter(isWorking).length} working · ${count(view.agents.length, 'agent')} on ${count(view.overview?.status === 'ready' ? view.overview.machines.length : 0, 'computer')}`,
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
		{:else if selected === 'projects' && view.trackerProjects}
			<hx-a class="po-action" href={resolve('/tracker-overview')}>Open Project Overview</hx-a>
		{:else if selected === 'projects' && !view.projectsFailed}
			<hx-a class="po-action hh-primary" href={resolve('/projects')}>Manage projects</hx-a>
		{/if}
	{/snippet}
	{#key selected}
		{#if selected === 'agents'}
			<HubHomeAgents agents={view.agents} {agentId} {send} {receipt} bind:chatOpen bind:chatName />
		{:else if selected === 'plans'}
			<HubHomePlans
				plans={view.plans}
				agents={view.agents ?? []}
				discuss={(id) => open('agents', id)}
			/>
		{:else if selected === 'scheduled'}
			<HubHomeSchedule runs={view.schedule} now={view.now} connected={view.routinesConnected} />
		{:else if selected === 'projects'}
			{#if view.trackerProjects}
				<hx-div class="hh-overview"
					><ProjectOverview snapshot={view.trackerProjects} standalone={false} /></hx-div
				>
			{:else if view.projectsFailed}
				<EmptyState as="div" className="po-empty hh-empty">
					<hx-p>Shared projects could not be read.</hx-p>
					<hx-button type="button" class="po-action" onclick={reload}>Try again</hx-button>
				</EmptyState>
			{:else}
				<HubHomeProjects projects={view.projects} snapshots={view.projectSnapshots} {readProject} />
			{/if}
		{:else if selected === 'quota'}
			<HubHomeQuota quota={view.quota} now={view.now} connected={view.quotaConnected} {reload} />
		{:else}
			<HubHomeWork overview={view.overview} work={view.work} now={view.now} />
		{/if}
	{/key}
</Modal>
