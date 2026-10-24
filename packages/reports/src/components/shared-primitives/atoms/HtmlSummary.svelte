<!-- @harness-tier atom -->
<!-- @harness-element summary -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'summary'} {...attributes}>
	{#if children}{@render children()}{/if}
</svelte:element>
