<!-- @harness-tier atom -->
<!-- @harness-element p -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'p'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
