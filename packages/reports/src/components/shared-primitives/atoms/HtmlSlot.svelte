<!-- @harness-tier atom -->
<!-- @harness-element slot -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'slot'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
