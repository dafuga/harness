<!-- @harness-tier atom -->
<!-- @harness-element feDistantLight -->
<svelte:options namespace="svg" />
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'feDistantLight'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
