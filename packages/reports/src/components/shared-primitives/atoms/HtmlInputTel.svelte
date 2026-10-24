<!-- @harness-tier atom -->
<!-- @harness-element input tel -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children, ...attributes }: { children?: Snippet; [attribute: string]: unknown } = $props();
</script>

<svelte:element this={'input'} {...attributes} type="tel">

</svelte:element>
