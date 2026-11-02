<!-- @harness-tier molecule -->
<!-- @harness-atoms ./atoms -->
<!-- @harness-uid u_hs4u7qlba4 -->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
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
		/** Optional empty rows; omitted content defaults to a visible empty message. */
		empty?: Snippet;
		/** Selects empty rows rather than body rows; defaults to false. */
		isEmpty?: boolean;
		/** Optional feature-owned frame classes; defaults to an empty string. */
		className?: string;
		/** Optional feature-owned table classes; defaults to an empty string. */
		tableClass?: string;
	} = $props();
	let frame: HTMLDivElement;
	let table: HTMLTableElement;
	let overflowing = $state(false);
	onMount(() => {
		const measure = () => (overflowing = table.scrollWidth > frame.clientWidth + 1);
		const observer = new ResizeObserver(measure);
		observer.observe(frame);
		observer.observe(table);
		measure();
		return () => observer.disconnect();
	});
</script>

<hx-div class="data-table-frame" data-harness-component="shared-primitives-data-table">
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users scroll the labelled table region.) -->
	<hx-div
		class="data-table {className}"
		role="region"
		aria-label={label}
		tabindex="0"
		bind:this={frame}
	>
		<hx-table class={tableClass} aria-label={label} bind:this={table}>
			<hx-thead>{@render header()}</hx-thead>
			<hx-tbody>
				{#if isEmpty}{@render empty?.()}{:else}{@render children()}{/if}
			</hx-tbody>
		</hx-table>
	</hx-div>
	{#if isEmpty && !empty}<hx-p class="table-note">No rows to display.</hx-p>{/if}
	{#if overflowing}<hx-p class="table-note">Scroll horizontally to see all columns.</hx-p>{/if}
</hx-div>

<style>
	.data-table-frame {
		min-width: 0;
		max-width: 100%;
	}
	.table-note {
		margin: var(--hx-space-8) 0 0;
		color: var(--hx-color-text-muted);
	}
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
