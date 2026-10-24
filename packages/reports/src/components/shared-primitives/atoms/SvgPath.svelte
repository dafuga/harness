<!-- @harness-tier atom -->
<!-- @harness-element path -->
<svelte:options namespace="svg" />
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'path'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
