<!-- @harness-tier atom -->
<!-- @harness-element kbd -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'kbd'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
