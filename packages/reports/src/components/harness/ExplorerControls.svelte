<script lang="ts">
	import CategoryImplementation from '../explorer-ui/harness/ExplorerControls.svelte';
	import type { ComponentProps } from 'svelte';
	let { filter = $bindable(), ...props }: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} bind:filter />
