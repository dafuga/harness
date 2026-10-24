<!-- @harness-tier atom -->
<!-- @harness-element feConvolveMatrix -->
<svelte:options namespace="svg" />
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'feConvolveMatrix'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
