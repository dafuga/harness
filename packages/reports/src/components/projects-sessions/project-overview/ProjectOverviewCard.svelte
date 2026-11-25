<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_5zc2xsq34f -->
<script lang="ts">
	import Card from '../../explorer-ui/explorer-kit/Card.svelte';
	import { trackerStageLabels } from '../../../../../../src/utils/projects-sessions/trackerPlanning';
	import type { OverviewCallout } from '../../../lib/projects-sessions/project-overview/projectOverview.types';
	import ProjectOverviewItem from './ProjectOverviewItem.svelte';
	import ProjectOverviewState from './ProjectOverviewState.svelte';
	import {
		countOf,
		countsText,
		formatWhen,
		inProgressItems,
		isCompact,
		sessionsText
	} from './projectOverviewPresentation';
	import type { ProjectOverviewCardProps } from './ProjectOverviewCard.types';
	let { card, now, onOpen }: ProjectOverviewCardProps = $props();
	const id = $props.id();
	/** Phones show the top item only; a desktop card shows this many before the rest is counted. */
	const shownItems = 3;
	const compact = $derived(isCompact(card.state));
	const working = $derived(inProgressItems(card.items));
	const blockedCount = $derived(card.counts.blocked);
</script>

{#snippet callout(surfaced: OverviewCallout, kind: 'attention' | 'blocked', label: string)}
	<hx-div class="po-callout" data-kind={kind}>
		<hx-div class="po-callout-head">
			<hx-span class="po-callout-label">{label}</hx-span>
			<hx-span class="po-callout-meta">updated {formatWhen(surfaced.item.updatedAt)}</hx-span>
			{#if surfaced.item.stage}
				<hx-span class="po-callout-meta">{trackerStageLabels[surfaced.item.stage]}</hx-span>
			{/if}
			<hx-span class="po-callout-id">{surfaced.item.id}</hx-span>
		</hx-div>
		<hx-p class="po-callout-text">{surfaced.text}</hx-p>
		<hx-div class="po-callout-actions">
			<hx-button type="button" class="po-action" onclick={() => onOpen(surfaced.item)}
				>Open item</hx-button
			>
		</hx-div>
	</hx-div>
{/snippet}

<Card
	as="article"
	label={card.agent}
	labelledby={`${id}-name`}
	component="projects-sessions-project-overview-project-overview-card"
	tone={`po-card po-${card.state}${compact ? ' po-compact' : ''}`}
>
	<hx-div class="po-card-head">
		<hx-div class="po-card-title">
			<hx-h3 id={`${id}-name`} class="po-name">{card.agent}</hx-h3>
			<hx-div class="po-sessions">
				{#if card.liveSessions > 0}
					<hx-span class="po-live-dot" aria-hidden="true"></hx-span>
				{/if}
				<hx-span>{sessionsText(card.liveSessions)}</hx-span>
			</hx-div>
		</hx-div>
		<ProjectOverviewState state={card.state} />
	</hx-div>

	{#if card.attention}
		{@render callout(card.attention, 'attention', 'Needs you')}
	{/if}
	{#if card.blocked && card.state === 'blocked'}
		{@render callout(card.blocked, 'blocked', 'Blocked')}
	{:else if blockedCount > 0 && card.blocked}
		<hx-p class="po-note">
			<hx-span class="po-note-lead"
				>{countOf(blockedCount, 'blocked item', 'blocked items')}</hx-span
			>
			<hx-span class="po-note-text">{card.blocked.text}</hx-span>
		</hx-p>
	{/if}

	{#if compact}
		<hx-p class="po-counts">{countsText(card.counts)}</hx-p>
	{:else if working.length}
		<hx-div class="po-work">
			<hx-h4 class="po-label">In progress</hx-h4>
			<hx-ul class="po-items" aria-label="In progress items of {card.agent}">
				{#each working.slice(0, shownItems) as item, position (item.id)}
					<ProjectOverviewItem {item} {now} {onOpen} extra={position > 0} />
				{/each}
			</hx-ul>
			{#if working.length > shownItems}
				<hx-p class="po-more">{working.length - shownItems} more in progress</hx-p>
			{/if}
		</hx-div>
	{/if}

	{#if card.milestone}
		<hx-div class="po-milestone">
			<hx-div class="po-milestone-head">
				<hx-span class="po-label">Last milestone</hx-span>
				<hx-span class="po-milestone-at">{formatWhen(card.milestone.at)}</hx-span>
			</hx-div>
			<hx-p class="po-milestone-text">{card.milestone.text}</hx-p>
		</hx-div>
	{/if}
</Card>
