<!-- @harness-tier organism -->
<!-- @harness-atoms shared-primitives/atoms -->
<script lang="ts">
	import CategoryImplementation from './explorer-ui/HarnessScreen.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
