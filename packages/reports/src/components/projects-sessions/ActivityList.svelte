<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts" generics="Item">
	import type { Snippet } from 'svelte';
	let {
		items,
		label,
		noun,
		preview,
		ordered = false,
		row
	}: {
		items: Item[];
		/** The accessible name of the list. */
		label: string;
		/** What the items are called in the control that shows the rest. */
		noun: string;
		/** How many items are shown before the rest is asked for. */
		preview: number;
		ordered?: boolean;
		row: Snippet<[Item]>;
	} = $props();
	let open = $state(false);
	let id = $derived('pa-' + label.toLowerCase().replace(/\W+/g, '-'));
</script>

<hx-element this={ordered ? 'ol' : 'ul'} class="pa-list" aria-label={label} {id}>
	{#each items as item, position (position)}
		<hx-li hidden={!open && position >= preview}>{@render row(item)}</hx-li>
	{/each}
</hx-element>
{#if items.length > preview}
	<hx-button
		type="button"
		class="pa-more"
		aria-expanded={open}
		aria-controls={id}
		onclick={() => (open = !open)}
		>{open ? `Show fewer ${noun}` : `Show all ${items.length} ${noun}`}</hx-button
	>
{/if}
