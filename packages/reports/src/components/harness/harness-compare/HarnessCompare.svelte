<script lang="ts">
	import CategoryImplementation from '../../explorer-ui/harness/harness-compare/HarnessCompare.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
