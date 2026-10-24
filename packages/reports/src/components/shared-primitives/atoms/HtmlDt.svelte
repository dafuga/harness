<!-- @harness-tier atom -->
<!-- @harness-element dt -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'dt'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
