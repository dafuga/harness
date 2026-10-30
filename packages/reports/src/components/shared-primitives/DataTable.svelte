<!-- @harness-tier molecule -->
<!-- @harness-atoms ./atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		label,
		header,
		children,
		empty,
		isEmpty = false,
		className = '',
		tableClass = ''
	}: {
		/** Accessible name shared by the table and its keyboard-scrollable region. */
		label: string;
		/** Header rows, including their column scopes. */
		header: Snippet;
		/** Body rows; data, ordering and actions remain with the caller. */
		children: Snippet;
		/** Optional complete empty-state rows, including their cell spans. */
		empty?: Snippet;
		/** Selects empty rows rather than body rows; defaults to false. */
		isEmpty?: boolean;
		/** Optional feature-owned frame classes; defaults to an empty string. */
		className?: string;
		/** Optional feature-owned table classes; defaults to an empty string. */
		tableClass?: string;
	} = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users scroll the labelled table region.) -->
<hx-div
	class="data-table {className}"
	data-harness-component="shared-primitives-data-table"
	role="region"
	aria-label={label}
	tabindex="0"
>
	<hx-table class={tableClass} aria-label={label}>
		<hx-thead>{@render header()}</hx-thead>
		<hx-tbody>
			{#if isEmpty}{@render empty?.()}{:else}{@render children()}{/if}
		</hx-tbody>
	</hx-table>
</hx-div>

<style>
	.data-table {
		position: relative;
		min-width: 0;
		max-width: 100%;
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	.data-table:focus-visible {
		outline: var(--hx-border-thick) solid var(--hx-color-tertiary);
		outline-offset: var(--hx-border-thin);
	}
</style>
