<!-- @harness-tier atom -->
<!-- @harness-element address -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'address'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
