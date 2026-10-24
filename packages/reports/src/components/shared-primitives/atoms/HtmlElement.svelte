<!-- @harness-tier atom -->
<!-- @harness-element svelte:element -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, this: tag = 'div', ...attributes }: { children?: Snippet; this?: string; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={tag} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
