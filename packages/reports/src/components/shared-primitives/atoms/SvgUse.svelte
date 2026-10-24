<!-- @harness-tier atom -->
<!-- @harness-element use -->
<svelte:options namespace="svg" />
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'use'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
