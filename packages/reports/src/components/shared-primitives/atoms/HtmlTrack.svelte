<!-- @harness-tier atom -->
<!-- @harness-element track -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'track'} {...attributes}>

</svelte:element>
