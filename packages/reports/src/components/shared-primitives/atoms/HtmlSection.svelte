<!-- @harness-tier atom -->
<!-- @harness-element section -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'section'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
