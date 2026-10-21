<script lang="ts">
	import CategoryImplementation from '../../explorer-ui/harness/explorer-index/ExplorerIndex.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
