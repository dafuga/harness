<!-- @harness-tier atom -->
<!-- @harness-element h6 -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'h6'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
