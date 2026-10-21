<script lang="ts">
	import CategoryImplementation from '../explorer-ui/harness/EntityOverview.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
