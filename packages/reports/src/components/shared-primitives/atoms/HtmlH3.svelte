<!-- @harness-tier atom -->
<!-- @harness-element h3 -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'h3'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
