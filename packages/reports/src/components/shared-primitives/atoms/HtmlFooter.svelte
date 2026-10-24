<!-- @harness-tier atom -->
<!-- @harness-element footer -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'footer'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
