<!-- @harness-tier atom -->
<!-- @harness-element figure -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'figure'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
