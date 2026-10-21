<script lang="ts">
	import CategoryImplementation from '../../explorer-ui/harness/harness-selectors/HarnessSelectors.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
