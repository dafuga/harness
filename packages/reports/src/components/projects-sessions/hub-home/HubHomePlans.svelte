<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_jz3ojqls6h -->
<script lang="ts">
	import LinkifiedText from '$reports/components/shared-primitives/LinkifiedText.svelte';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import Pill from '$reports/components/explorer-ui/explorer-kit/Pill.svelte';
	import type {
		HomeAgent,
		HomePlan,
		HomePlanState
	} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { count, planLabels, planStates, when } from './hubHomePresentation';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';

	let {
		plans,
		agents,
		discuss,
		openPlan
	}: {
		plans: HomePlan[] | null;
		agents: HomeAgent[];
		discuss: (id: string) => void;
		openPlan: (id: string, trigger: HTMLElement) => void;
	} = $props();
	const planTones: Record<HomePlanState, string> = {
		draft: 'quiet',
		'in-review': 'needs-you',
		approved: 'active',
		'in-progress': 'active',
		done: 'done'
	};
	let filter = $state<HomePlanState | 'all'>('all');
	let opened = $state<string>();
	const visible = $derived(
		plans?.filter((plan) => filter === 'all' || plan.state === filter) ?? []
	);
</script>

{#if plans === null}
	<HubHomeSkeleton rows={6} />
{:else if !plans.length}
	<EmptyState as="div" className="po-empty hh-empty">No plans are on the Tracker.</EmptyState>
{:else}
	<hx-div class="po-filters hh-filters" role="group" aria-label="Plan status">
		<hx-button
			class="po-chip"
			type="button"
			aria-pressed={filter === 'all'}
			onclick={() => (filter = 'all')}
			>All <hx-span class="po-chip-count">{plans.length}</hx-span></hx-button
		>
		{#each planStates as state (state)}
			<hx-button
				class="po-chip"
				type="button"
				aria-pressed={filter === state}
				onclick={() => (filter = state)}
			>
				{planLabels[state]}
				<hx-span class="po-chip-count"
					>{plans.filter((plan) => plan.state === state).length}</hx-span
				>
			</hx-button>
		{/each}
	</hx-div>
	{#if !visible.length}<EmptyState as="div" className="po-empty hh-empty"
			>No plans match this status.</EmptyState
		>{/if}
	<hx-div class="po-grid hh-plan-grid">
		{#each visible as plan (plan.id)}
			{@const agent = agents.find((agent) => agent.name === plan.project && agent.itemId)}
			{@const tone = planTones[plan.state]}
			<hx-article class={`po-card po-${tone} hh-plan hh-row-target`}>
				<hx-div class="po-card-head">
					<hx-div class="po-card-title">
						<hx-h3 class="po-name">
							<LinkifiedText text={plan.title} />
							<hx-button
								type="button"
								class="hh-open-row"
								aria-label={plan.title}
								aria-haspopup="dialog"
								onclick={(event) => openPlan(plan.id, event.currentTarget)}
							>
							</hx-button>
						</hx-h3>
						<hx-p class="po-sessions"
							>{[plan.project, `updated ${when(plan.updatedAt)}`].filter(Boolean).join(' · ')}</hx-p
						>
					</hx-div>
					<Pill tone={`hh-tone po-state po-${tone}`} state={tone}
						><hx-span class="po-mark" aria-hidden="true"></hx-span>{planLabels[plan.state]}</Pill
					>
				</hx-div>
				<hx-span class="hh-progress" aria-label={`${plan.done} of ${plan.total} steps`}>
					{#if plan.total}<hx-span class="hh-progress-bar"
							><hx-span style:width={`${(plan.done / plan.total) * 100}%`}></hx-span></hx-span
						>{/if}
					<hx-span class="hh-progress-text">{plan.done}/{plan.total}</hx-span>
				</hx-span>
				{#if plan.steps.length}
					<hx-ol class="hh-steps">
						{#each opened === plan.id ? plan.steps : plan.steps.slice(0, 3) as step (step.id)}
							<hx-li class="hh-step" data-done={step.done}
								><LinkifiedText text={step.title} /></hx-li
							>
						{/each}
					</hx-ol>
				{:else}<hx-p class="po-sessions">No steps recorded.</hx-p>{/if}
				<hx-div class="po-callout-actions">
					{#if plan.steps.length > 3}
						<hx-button
							class="po-action"
							type="button"
							aria-expanded={opened === plan.id}
							onclick={() => (opened = opened === plan.id ? undefined : plan.id)}
						>
							{opened === plan.id ? 'Show fewer steps' : `Show ${count(plan.steps.length, 'step')}`}
						</hx-button>
					{/if}
					{#if agent}<hx-button class="po-action" type="button" onclick={() => discuss(agent.id)}
							>Discuss</hx-button
						>{/if}
				</hx-div>
			</hx-article>
		{/each}
	</hx-div>
{/if}
