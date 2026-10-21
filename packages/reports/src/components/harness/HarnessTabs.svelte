<script lang="ts" generics="View extends string">
	import CategoryImplementation from '../explorer-ui/harness/HarnessTabs.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation<View>> = $props();
</script>

<CategoryImplementation {...props} />
