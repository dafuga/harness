<!-- @harness-tier atom -->
<!-- @harness-element button -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'button'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
