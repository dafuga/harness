<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import type { EntityLens, EntityNav } from '../../utils/entityLens';
	import ExplorerUsageLink from './ExplorerUsageLink.svelte';
	import { usageIdentity } from '../../utils/explorer-ui/entityUsage';
	let {
		consumers,
		nav,
		lens,
		mediaBase,
		limit = 3
	}: {
		/** What uses the entity at the shown revision, in the order it is given. */
		consumers: ExplorerEntity[];
		nav: EntityNav;
		lens: EntityLens;
		mediaBase: string;
		/** Still accepted, never changes it: every footer is one unheaded list. */
		layout?: 'grouped' | 'flat';
		/** Legacy lower limits remain supported; no footer shows more than three links. */
		limit?: number;
	} = $props();
	// The first three distinct consumers, each where it was first named; never reordered by kind.
	let distinct = $derived([
		...new Map(consumers.map((item) => [usageIdentity(item), item])).values()
	]);
	let items = $derived(distinct.slice(0, Math.min(3, Math.max(0, limit))));
	let omitted = $derived(distinct.length - items.length);
</script>

<!-- One footer for every card and table row: each consumer a link with its own preview. -->
<hx-div class="ex-usage" role="group" aria-label="Used In">
	<hx-span>Used In</hx-span>{#if distinct.length === 0}<hx-span>—</hx-span>{:else}
		<hx-ul>
			{#each items as item (usageIdentity(item))}
				<hx-li><ExplorerUsageLink entity={item} {nav} {lens} {mediaBase} /></hx-li>
			{/each}
			{#if omitted > 0}
				<hx-li>
					<hx-span aria-hidden="true">…</hx-span>
					<hx-span class="ex-usage-more"
						>{omitted} more {omitted === 1 ? 'usage' : 'usages'}</hx-span
					>
				</hx-li>
			{/if}
		</hx-ul>
	{/if}
</hx-div>

<style>
	/* Smaller and quieter than what it belongs to. */
	.ex-usage {
		display: grid;
		align-items: baseline;
		gap: var(--hx-space-4) var(--hx-space-10);
		min-width: 0;
		color: var(--ex-muted);
		font-size: var(--hx-type-size-xs);
		line-height: var(--hx-style-leading-normal);
	}
	.ex-usage ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--hx-space-4) var(--hx-space-10);
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* Read out in place of the ellipsis, never shown. */
	.ex-usage-more {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
