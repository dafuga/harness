<script lang="ts">
	import CategoryImplementation from '../../explorer-ui/harness/entity-change/EntityChange.svelte';
	import type { ComponentProps } from 'svelte';
	let { full = $bindable(false), ...props }: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} bind:full />
