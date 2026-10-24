<!-- @harness-tier atom -->
<!-- @harness-element col -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'col'} {...attributes}>

</svelte:element>
