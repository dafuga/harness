<!-- @harness-tier atom -->
<!-- @harness-element thead -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'thead'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
