<script lang="ts">
	import type { ExplorerEntity } from '../models/Explorer.types';
	import type { EntityLens, EntityNav } from '../utils/entityLens';
	import ExplorerUsageLink from './ExplorerUsageLink.svelte';
	let {
		consumers,
		nav,
		lens,
		mediaBase
	}: {
		/** What uses the entity at the shown revision, each once. */
		consumers: ExplorerEntity[];
		nav: EntityNav;
		lens: EntityLens;
		mediaBase: string;
	} = $props();
</script>

<!-- One footer for every card and table row: each consumer a link with its own preview. -->
<div class="ex-usage" role="group" aria-label="Used In">
	<span>Used In</span>{#each consumers as item (item.id)}<ExplorerUsageLink
			entity={item}
			{nav}
			{lens}
			{mediaBase}
		/>{:else}<span>—</span>{/each}
</div>

<style>
	/* Smaller and quieter than what it belongs to. */
	.ex-usage {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 10px;
		min-width: 0;
		color: var(--ex-muted);
		font-size: 0.75rem;
		line-height: 1.5;
	}
</style>
