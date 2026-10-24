<!-- @harness-tier atom -->
<!-- @harness-element label -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'label'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
