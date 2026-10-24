<!-- @harness-tier atom -->
<!-- @harness-element line -->
<svelte:options namespace="svg" />
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'line'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
