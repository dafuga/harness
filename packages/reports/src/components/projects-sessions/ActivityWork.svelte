<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { WorkItem } from '../../../../../src/core/activityTypes';
	import { activityTime } from '../../utils/projects-sessions/activityDisplay';
	import { plural } from '../../helpers/strings/plural';
	import ActivityList from './ActivityList.svelte';
	let {
		work,
		href,
		recorded = false
	}: {
		work: WorkItem[];
		href: (commit: string) => string;
		/** True for a built history, whose reasons include those its records accepted. */
		recorded?: boolean;
	} = $props();
</script>

{#snippet commitRow(item: WorkItem)}
	<hx-div class="pa-row">
		<hx-strong>{item.subject}</hx-strong>
		<hx-a href={href(item.commit)} title={'The page of commit ' + item.commit}
			>{item.commit.slice(0, 7)}</hx-a
		>
	</hx-div>
	<hx-div class="pa-meta">
		<hx-time datetime={item.committedAt}>{activityTime(item.committedAt)} UTC</hx-time>
		<hx-span>{item.branches.length ? item.branches.join(', ') : 'on no branch'}</hx-span>
		<hx-span>{plural(item.files, 'file')}</hx-span>
		<hx-span>{plural(item.unitCount ?? item.units.length, 'component')}</hx-span>
		<hx-span>{plural(item.reasonCount, 'reason')}</hx-span>
	</hx-div>
	{#if item.units.length || item.reasons.length}
		<hx-details class="pa-detail">
			<hx-summary>Components and reasons</hx-summary>
			<hx-div class="pa-tags">
				{#each item.units as unit (unit)}<hx-span class="pa-chip">{unit}</hx-span>{/each}
				{#if item.unitCount > item.units.length}
					<hx-span class="pa-note"
						>{item.unitCount - item.units.length} more components are on its page.</hx-span
					>
				{/if}
			</hx-div>
			{#if item.reasons.length}
				<hx-p class="pa-note">
					{recorded ? 'Noted on this commit or accepted by its records' : 'Noted on this commit'}:
				</hx-p>
			{/if}
			{#each item.reasons as reason, position (position)}
				<hx-p class="pa-reason"><hx-span>{reason.unit}</hx-span> {reason.behavior}</hx-p>
			{/each}
			{#if item.reasonCount > item.reasons.length}
				<hx-small>{item.reasonCount - item.reasons.length} more reasons are on its page.</hx-small>
			{/if}
		</hx-details>
	{/if}
	{#if item.reasonCount === 0}<hx-small>No reason is noted on this commit.</hx-small>{/if}
{/snippet}

<hx-section class="pa-card" aria-label="Recent work">
	<hx-div class="pa-head">
		<hx-h2>Recent work</hx-h2>
		<hx-span class="pa-note">Committed · from Git</hx-span>
	</hx-div>
	{#if work.length}
		<ActivityList
			items={work}
			label="Recent commits"
			noun="commits"
			preview={5}
			ordered
			row={commitRow}
		/>
	{:else}
		<hx-p class="pa-empty">No commit is in this history yet.</hx-p>
	{/if}
</hx-section>
