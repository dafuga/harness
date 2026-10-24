<!-- @harness-tier atom -->
<!-- @harness-element fePointLight -->
<svelte:options namespace="svg" />
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'fePointLight'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
