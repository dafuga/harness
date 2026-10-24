<!-- @harness-tier atom -->
<!-- @harness-element tspan -->
<svelte:options namespace="svg" />
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'tspan'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
