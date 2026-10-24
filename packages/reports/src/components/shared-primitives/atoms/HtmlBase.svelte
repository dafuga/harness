<!-- @harness-tier atom -->
<!-- @harness-element base -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'base'} {...attributes}>

</svelte:element>
