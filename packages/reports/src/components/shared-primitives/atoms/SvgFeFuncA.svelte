<!-- @harness-tier atom -->
<!-- @harness-element feFuncA -->
<svelte:options namespace="svg" />
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'feFuncA'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
