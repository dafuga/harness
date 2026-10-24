<!-- @harness-tier atom -->
<!-- @harness-element h1 -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'h1'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
