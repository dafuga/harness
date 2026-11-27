<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_axpmgg2n3c -->
<script lang="ts">
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import { planLabels, relativeWhen, runDay, runTime } from './hubHomePresentation';
	import { scheduledChatItem } from './hubHomeMessages';
	import { homeCosChat } from './hubHomeChatContext.svelte';
	import type { HomePlannableView, OpenHomeSection } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import HubHomeCard from './HubHomeCard.svelte';
	import HubHomeRow from './HubHomeRow.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';

	let {
		view,
		open
	}: {
		view: HomePlannableView;
		open: OpenHomeSection;
	} = $props();
	const chat = homeCosChat();
</script>

{#snippet empty(text: string, action?: string)}
	<EmptyState as="div" className="po-empty hh-empty"
		><hx-p>{text}</hx-p>
		{#if action && view.agents?.some((agent) => agent.itemId)}<hx-button
				type="button"
				class="po-action"
				onclick={() => open('agents')}>{action}</hx-button
			>{/if}
	</EmptyState>
{/snippet}

<HubHomeCard
	section="plans"
	total={view.plans?.length}
	summary={view.plans === null
		? 'Loading plans…'
		: view.needsMac
			? 'No plan data'
			: !view.plans.length
				? 'No plans yet'
				: `${view.plans.filter((plan) => plan.state !== 'done').length} open · ${view.plans.filter((plan) => plan.state === 'done').length} done`}
	open={() => open('plans')}
>
	{#if view.plans === null}
		<HubHomeSkeleton />
	{:else if view.needsMac}
		{@render empty('Plans appear when your Mac shares them.')}
	{:else if view.plans.length}
		<hx-ul class="po-items">
			{#each view.plans.slice(0, 4) as plan, index (plan.id)}
				<HubHomeRow
					title={plan.title}
					activate={() => open('plans', plan.id)}
					meta={[
						plan.project,
						planLabels[plan.state],
						`updated ${relativeWhen(plan.updatedAt, view.now)}`
					]
						.filter(Boolean)
						.join(' · ')}
					extra={index >= 2}
				>
					{#snippet trailing()}
						<hx-span class="hh-progress" aria-label={`${plan.done} of ${plan.total} steps`}>
							{#if plan.total}
								<hx-span class="hh-progress-bar"
									><hx-span style:width={`${(plan.done / plan.total) * 100}%`}></hx-span></hx-span
								>
							{/if}
							<hx-span class="hh-progress-text">{plan.done}/{plan.total}</hx-span>
						</hx-span>
					{/snippet}
				</HubHomeRow>
			{/each}
		</hx-ul>
	{:else}
		{@render empty(
			'No plans yet. Ask an agent to plan something and it is kept here.',
			'Start a plan'
		)}
	{/if}
</HubHomeCard>

<HubHomeCard
	section="scheduled"
	total={view.schedule?.length}
	summary={view.schedule === null
		? 'Loading schedule…'
		: view.needsMac
			? 'No schedule data'
			: view.schedule[0]
				? `Next: ${runDay(view.schedule[0].at, view.now).toLowerCase()} ${runTime(view.schedule[0].at)}`
				: 'Nothing scheduled'}
	open={() => open('scheduled')}
>
	{#if view.schedule === null}
		<HubHomeSkeleton />
	{:else if view.needsMac}
		{@render empty('Scheduled runs appear when your Mac shares them.')}
	{:else if view.schedule.length}
		<hx-ul class="po-items hh-runs">
			{#each view.schedule.slice(0, 4) as run, index (`${run.source}:${run.id}`)}
				<HubHomeRow
					title={run.title}
					activate={(trigger) => chat?.open(trigger, scheduledChatItem(run))}
					meta={[run.agent, run.machine, run.paused ? 'Paused' : run.recurring ? 'Repeats' : null]
						.filter(Boolean)
						.join(' · ')}
					extra={index >= 2}
				>
					{#snippet lead()}
						<hx-span class="hh-when" data-paused={run.paused ? '' : undefined}>
							<hx-span class="hh-when-day">{runDay(run.at, view.now)}</hx-span>
							<hx-span class="hh-when-time">{runTime(run.at)}</hx-span>
						</hx-span>
					{/snippet}
				</HubHomeRow>
			{/each}
		</hx-ul>
	{:else}
		{@render empty(
			'Nothing is scheduled. Routines and one-off runs appear here in time order.',
			'Schedule a task'
		)}
	{/if}
</HubHomeCard>
