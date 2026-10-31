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
		className = ''
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
	} = $props();
</script>

{#if rows.length === 0}
	{#if empty}{@render empty()}{:else}
		<hx-p
			class="detail-list empty-detail-list {className}"
			data-harness-component="shared-primitives-detail-list">No details to display.</hx-p
		>
	{/if}
{:else}
	<hx-dl class="detail-list {className}" data-harness-component="shared-primitives-detail-list">
		{#each rows as row, position (rowKey(row, position))}
			<hx-div class="detail-row">
				<hx-dt>{@render label(row)}</hx-dt>
				<hx-dd>{@render children(row)}</hx-dd>
			</hx-div>
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
