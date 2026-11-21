<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_yo3goi2ees -->
<script lang="ts">
	import { shortCommit } from '$reports/helpers/strings/shortCommit';
	import { resolve } from '$app/paths';
	import EmptyState from '$shared/explorer-ui/explorer-kit/EmptyState.svelte';
	import { statusLabel } from '$shared/projects-sessions/project-overview/projectOverviewPresentation';
	import {
		count,
		planLabels,
		relativeWhen,
		runDay,
		runTime,
		workSummary,
		workEta
	} from './hubHomePresentation';
	import { projectInventory, inventorySummary } from './hubHomeProjects';
	import type { HomeView, OpenHomeSection } from './hubHomeView.types';
	import HubHomeCard from './HubHomeCard.svelte';
	import HubHomeRow from './HubHomeRow.svelte';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';

	let { view, open }: { view: HomeView; open: OpenHomeSection } = $props();
	const latest = $derived(
		view.projects
			?.map((project) => ({
				project,
				commit: view.projectSnapshots[project.id]?.commits[0]
			}))
			.filter(({ commit }) => commit)
			.sort((a, b) => Date.parse(b.commit!.authoredAt) - Date.parse(a.commit!.authoredAt))[0]
	);
</script>

{#snippet empty(text: string)}
	<EmptyState as="div" className="hh-empty">{text}</EmptyState>
{/snippet}

<HubHomeCard
	section="plans"
	total={view.plans?.length}
	summary={view.plans === null
		? 'Loading plans…'
		: `${view.plans.filter((plan) => plan.state !== 'done').length} open · ${view.plans.filter((plan) => plan.state === 'done').length} done`}
	open={() => open('plans')}
>
	{#if view.plans === null}
		<HubHomeSkeleton />
	{:else if view.plans.length}
		<hx-ul class="po-items">
			{#each view.plans.slice(0, 4) as plan, index (plan.id)}
				<HubHomeRow
					title={plan.title}
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
		{@render empty('No plans are on the Tracker.')}
	{/if}
</HubHomeCard>

<HubHomeCard
	section="scheduled"
	total={view.schedule?.length}
	summary={view.schedule === null
		? 'Loading schedule…'
		: view.schedule[0]
			? `Next: ${runDay(view.schedule[0].at, view.now).toLowerCase()} ${runTime(view.schedule[0].at)}`
			: 'No upcoming runs'}
	open={() => open('scheduled')}
>
	{#if view.schedule === null}
		<HubHomeSkeleton />
	{:else if view.schedule.length}
		<hx-ul class="po-items hh-runs">
			{#each view.schedule.slice(0, 4) as run, index (`${run.source}:${run.id}`)}
				<HubHomeRow
					title={run.title}
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
		{@render empty('Nothing is scheduled.')}
	{/if}
</HubHomeCard>

<HubHomeCard
	section="projects"
	total={view.projects?.length}
	summary={view.projects === null
		? 'Loading projects…'
		: latest?.commit
			? `Last change: ${latest.project.name}, ${relativeWhen(latest.commit.authoredAt, view.now)}`
			: count(view.projects.length, 'shared project')}
	open={() => open('projects')}
>
	{#if view.projects === null}
		<HubHomeSkeleton rows={3} />
	{:else if view.projects.length}
		<hx-ul class="po-items">
			{#each view.projects.slice(0, 4) as project, index (project.id)}
				{@const snapshot = view.projectSnapshots[project.id]}
				{@const change = snapshot?.commits[0]}
				<HubHomeRow
					title={project.name}
					meta={snapshot
						? inventorySummary(projectInventory(snapshot))
						: `${project.sourceRepository.owner}/${project.sourceRepository.name}`}
					extra={index >= 2}
					wide={index >= 3}
				>
					{#snippet trailing()}
						{#if change}<hx-span class="hh-change"
								><hx-code>{shortCommit(change.hash)}</hx-code>
								{relativeWhen(change.authoredAt, view.now)}</hx-span
							>{/if}
					{/snippet}
				</HubHomeRow>
			{/each}
		</hx-ul>
	{:else}
		{@render empty('No shared projects yet.')}
		<hx-a href={resolve('/projects')} class="po-action">Open projects</hx-a>
	{/if}
</HubHomeCard>

<HubHomeCard
	section="wip"
	total={view.overview ? view.work.length : undefined}
	summary={view.overview === null ? 'Loading work…' : 'Soonest to finish first'}
	open={() => open('wip')}
>
	{#if view.overview === null}
		<HubHomeSkeleton />
	{:else if view.work.length}
		<hx-p class="hh-wip-line">{workSummary(view.work)}</hx-p>
		<hx-ul class="po-items">
			{#each view.work.slice(0, 8) as item, index (item.id)}
				{@const eta = workEta(item.due, view.now)}
				<HubHomeRow
					title={item.title}
					meta={`${item.project} · ${statusLabel(item.status)}`}
					extra={index >= 2}
					wide={index >= 4}
				>
					{#snippet trailing()}<hx-span class="po-eta" data-tone={eta.tone}>{eta.text}</hx-span
						>{/snippet}
				</HubHomeRow>
			{/each}
		</hx-ul>
	{:else}
		{@render empty('No work is in progress.')}
	{/if}
</HubHomeCard>
