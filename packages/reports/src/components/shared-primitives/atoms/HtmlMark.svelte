<!-- @harness-tier atom -->
<!-- @harness-element mark -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'mark'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
