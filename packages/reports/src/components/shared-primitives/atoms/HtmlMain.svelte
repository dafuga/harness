<!-- @harness-tier atom -->
<!-- @harness-element main -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'main'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
