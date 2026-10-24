<!-- @harness-tier atom -->
<!-- @harness-element feImage -->
<svelte:options namespace="svg" />
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'feImage'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
