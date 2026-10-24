<!-- @harness-tier atom -->
<!-- @harness-element dfn -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'dfn'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
