<!-- @harness-tier atom -->
<!-- @harness-element code -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'code'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
