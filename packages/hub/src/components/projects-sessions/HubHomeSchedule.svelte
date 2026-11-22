<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_gtrdllvpk7 -->
<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import EmptyState from '$reports/components/explorer-ui/explorer-kit/EmptyState.svelte';
	import type { HomeRun } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
	import { runDay, runTime } from './hubHomePresentation';
	import HubHomeSkeleton from './HubHomeSkeleton.svelte';

	let { runs, now, connected }: { runs: HomeRun[] | null; now: number; connected: boolean } =
		$props();
	let filter = $state<'all' | 'tracker' | 'claude'>('all');
	const filters = [
		{ id: 'all', label: 'All' },
		{ id: 'tracker', label: 'Tracker' },
		{ id: 'claude', label: 'Claude routines' }
	] as const;
	const groups = $derived.by(() => {
		const days = new SvelteMap<string, HomeRun[]>();
		for (const run of runs ?? []) {
			if (filter !== 'all' && run.source !== filter) continue;
			const day = runDay(run.at, now);
			days.set(day, [...(days.get(day) ?? []), run]);
		}
		return [...days];
	});
</script>

{#if runs === null}
	<HubHomeSkeleton rows={6} />
{:else}
	{#if runs.length}
		<hx-div class="po-filters hh-filters" role="group" aria-label="Schedule source">
			{#each filters as entry (entry.id)}
				<hx-button
					type="button"
					class="po-chip"
					aria-pressed={filter === entry.id}
					onclick={() => (filter = entry.id)}>{entry.label}</hx-button
				>
			{/each}
		</hx-div>
	{/if}
	{#if !connected}
		<hx-p class="po-sessions"
			>Claude scheduled routines are unavailable. <hx-a
				href="https://claude.ai/code/routines"
				target="_blank"
				rel="noreferrer">Open Claude routines</hx-a
			></hx-p
		>
	{/if}
	{#if !groups.length}<EmptyState as="div" className="hh-empty"
			>Nothing is scheduled here.</EmptyState
		>{/if}
	<hx-div class="hh-agenda">
		{#each groups as [day, agenda] (day)}
			<hx-section class="hh-group">
				<hx-h3 class="po-band-title">{day}</hx-h3>
				<hx-ul class="po-items">
					{#each agenda as run (`${run.source}:${run.id}`)}
						<hx-li class="po-item hh-agenda-row" data-paused={run.paused ? '' : undefined}>
							<hx-div class="hh-row">
								<hx-time class="hh-agenda-time" datetime={run.at}>{runTime(run.at)}</hx-time>
								<hx-span class="po-item-text">
									<hx-span class="po-item-title">{run.title}</hx-span>
									<hx-span class="po-item-meta"
										>{[run.agent, run.machine].filter(Boolean).join(' · ')}</hx-span
									>
								</hx-span>
								<hx-span class="hh-repeat">
									{#if run.recurring}<hx-span aria-hidden="true">↻ </hx-span>{/if}
									{run.paused
										? 'Paused'
										: run.source === 'claude'
											? 'Claude routine'
											: run.recurring
												? 'Repeats'
												: 'Tracker'}
								</hx-span>
							</hx-div>
						</hx-li>
					{/each}
				</hx-ul>
			</hx-section>
		{/each}
	</hx-div>
{/if}
