<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_6kpzjxqlbp -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Modal from '$shared/Modal.svelte';
	import HarnessIcon from '$shared/explorer-ui/HarnessIcon.svelte';
	import type {
		HomeChatReceipt,
		HomeSection
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { sections, workSummary, count } from './hubHomePresentation';
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
	const summary = $derived(
		{
			agents:
				view.agents === null
					? 'Loading agents…'
					: `${view.agents.filter((agent) => agent.state === 'working').length} working · ${count(view.agents.length, 'agent')} on ${count(view.overview?.status === 'ready' ? view.overview.machines.length : 0, 'computer')}`,
			plans: 'Progress and next steps from Tracker.',
			scheduled: 'Tracker due items and Claude scheduled routines.',
			projects: 'Apps, pages, components and changes.',
			wip: workSummary(view.work),
			quota: 'Remaining allowance across subscriptions.'
		}[selected]
	);
</script>

<Modal isOpen title={sections[selected].title} {summary} variant="section" onClose={close}>
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
		{:else if selected === 'projects'}
			<hx-a class="po-action hh-primary" href={resolve('/projects')}>Manage projects</hx-a>
		{/if}
	{/snippet}
	{#key selected}
		{#if selected === 'agents'}
			<HubHomeAgents agents={view.agents} {agentId} {send} {receipt} bind:chatOpen />
		{:else if selected === 'plans'}
			<HubHomePlans
				plans={view.plans}
				agents={view.agents ?? []}
				discuss={(id) => open('agents', id)}
			/>
		{:else if selected === 'scheduled'}
			<HubHomeSchedule runs={view.schedule} now={view.now} connected={view.routinesConnected} />
		{:else if selected === 'projects'}
			<HubHomeProjects projects={view.projects} {readProject} />
		{:else if selected === 'quota'}
			<HubHomeQuota quota={view.quota} now={view.now} connected={view.quotaConnected} {reload} />
		{:else}
			<HubHomeWork overview={view.overview} work={view.work} now={view.now} />
		{/if}
	{/key}
</Modal>
