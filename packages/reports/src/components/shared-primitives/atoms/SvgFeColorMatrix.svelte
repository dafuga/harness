<!-- @harness-tier atom -->
<!-- @harness-element feColorMatrix -->
<svelte:options namespace="svg" />
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'feColorMatrix'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
