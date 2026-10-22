<script lang="ts">
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import type { EntityLens, EntityNav } from '../../utils/entityLens';
	import ExplorerUsageLink from './ExplorerUsageLink.svelte';
	let {
		consumers,
		nav,
		lens,
		mediaBase
	}: {
		/** What uses the entity at the shown revision, in the order it is given. */
		consumers: ExplorerEntity[];
		nav: EntityNav;
		lens: EntityLens;
		mediaBase: string;
		/** Still accepted, never changes it: every footer is one unheaded list. */
		layout?: 'grouped' | 'flat';
	} = $props();
	// The first three distinct consumers, each where it was first named; never reordered by kind.
	let items = $derived([...new Map(consumers.map((item) => [item.id, item])).values()].slice(0, 3));
</script>

<!-- One footer for every card and table row: each consumer a link with its own preview. -->
<div class="ex-usage" role="group" aria-label="Used In">
	<span>Used In</span>{#if items.length === 0}<span>—</span>{:else}
		<ul>
			{#each items as item (item.id)}
				<li><ExplorerUsageLink entity={item} {nav} {lens} {mediaBase} /></li>
			{/each}
		</ul>
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
</style>
