<!-- @harness-tier atom -->
<!-- @harness-element hr -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'hr'} {...attributes}>

</svelte:element>
