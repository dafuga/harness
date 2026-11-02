<!-- @harness-tier molecule -->
<!-- @harness-atoms ./atoms -->
<script lang="ts" generics="Row">
	import type { Snippet } from 'svelte';
	let {
		rows,
		rowKey,
		label,
		children,
		empty,
		className = '',
		grouped = true,
		termTitle,
		valueTitle,
		valueClass
	}: {
		/** Rows in their display order; labels and values remain domain-owned. */
		rows: Row[];
		/** Stable unique key for each row; repeated visible labels may have distinct keys. */
		rowKey: (row: Row, position: number) => string | number;
		/** Label content for the row's semantic definition term. */
		label: Snippet<[Row]>;
		/** Value content for the row's semantic definition description. */
		children: Snippet<[Row]>;
		/** Optional empty content; omitted content defaults to a visible empty message. */
		empty?: Snippet;
		/** Optional feature-owned classes; defaults to an empty string. */
		className?: string;
		/** Wrap each term/value pair in a row container; defaults to true. False preserves flat lists. */
		grouped?: boolean;
		/** Optional term tooltip callback; defaults to undefined, omitting title. */
		termTitle?: (row: Row) => string | undefined;
		/** Optional value tooltip callback; defaults to undefined, omitting title. */
		valueTitle?: (row: Row) => string | undefined;
		/** Optional value class callback; defaults to undefined, omitting additional classes. */
		valueClass?: (row: Row) => string;
	} = $props();
</script>

{#snippet definition(row: Row)}
	<hx-dt title={termTitle?.(row)}>{@render label(row)}</hx-dt>
	<hx-dd title={valueTitle?.(row)} class={valueClass?.(row)}>{@render children(row)}</hx-dd>
{/snippet}

{#if rows.length === 0}
	{#if empty}
		{@render empty()}
	{:else}
		<hx-p
			class="detail-list empty-detail-list {className}"
			data-harness-component="shared-primitives-detail-list">No details to display.</hx-p
		>
	{/if}
{:else}
	<hx-dl class="detail-list {className}" data-harness-component="shared-primitives-detail-list">
		{#each rows as row, position (rowKey(row, position))}
			{#if grouped}
				<hx-div class="detail-row">{@render definition(row)}</hx-div>
			{:else}
				{@render definition(row)}
			{/if}
		{/each}
	</hx-dl>
{/if}

<style>
	.empty-detail-list {
		margin: 0;
		color: var(--hx-color-text-muted);
	}
	dl {
		min-width: 0;
		margin: 0;
	}
	.detail-row {
		display: grid;
		min-width: 0;
		gap: var(--hx-space-5);
		overflow-wrap: anywhere;
	}
	dd {
		min-width: 0;
		margin: 0;
	}
</style>
