<!-- @harness-tier atom -->
<!-- @harness-element pre -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'pre'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
