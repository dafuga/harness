<!-- @harness-tier organism -->
<!-- @harness-atoms shared-primitives/atoms -->
<!-- @harness-uid u_hcvspop376 -->
<script lang="ts">
	import CategoryImplementation from './shared-primitives/FilterDialog.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
