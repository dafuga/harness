<script lang="ts">
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import type { EntityLens, EntityNav } from '../../utils/entityLens';
	import { usageGroups } from '../../utils/entityUsage';
	import ExplorerUsageLink from './ExplorerUsageLink.svelte';
	let {
		consumers,
		nav,
		lens,
		mediaBase,
		layout = 'grouped'
	}: {
		/** What uses the entity at the shown revision, each once. */
		consumers: ExplorerEntity[];
		nav: EntityNav;
		lens: EntityLens;
		mediaBase: string;
		/** Grouped under kind headings, or one unheaded list in the same order. */
		layout?: 'grouped' | 'flat';
	} = $props();
	let groups = $derived(usageGroups(consumers));
	let items = $derived(groups.flatMap((group) => group.items));
</script>

<!-- One footer for every card and table row: each consumer a link with its own preview. -->
<div class="ex-usage" role="group" aria-label="Used In">
	<span>Used In</span>{#if groups.length === 0}<span>—</span>{/if}
	{#if layout === 'flat'}
		{#if items.length > 0}
			<ul>
				{#each items as item (item.id)}
					<li><ExplorerUsageLink entity={item} {nav} {lens} {mediaBase} /></li>
				{/each}
			</ul>
		{/if}
	{:else}
		{#each groups as group (group.title)}
			<ul aria-label={group.title}>
				<li class="ex-usage-kind">{group.title}</li>
				{#each group.items as item (item.id)}
					<li><ExplorerUsageLink entity={item} {nav} {lens} {mediaBase} /></li>
				{/each}
			</ul>
		{/each}
	{/if}
</div>

<style>
	/* Smaller and quieter than what it belongs to. */
	.ex-usage {
		display: grid;
		align-items: baseline;
		gap: 4px 10px;
		min-width: 0;
		color: var(--ex-muted);
		font-size: 0.75rem;
		line-height: 1.5;
	}
	.ex-usage ul {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.ex-usage-kind {
		flex-basis: 100%;
	}
</style>
