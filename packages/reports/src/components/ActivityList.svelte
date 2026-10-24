<!-- @harness-tier organism -->
<!-- @harness-atoms shared-primitives/atoms -->
<script lang="ts" generics="Item">
	import CategoryImplementation from './projects-sessions/ActivityList.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation<Item>> = $props();
</script>

<CategoryImplementation {...props} />
