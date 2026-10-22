<script lang="ts">
	import CategoryImplementation from '../explorer-ui/harness/EntityHistoryScreen.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
