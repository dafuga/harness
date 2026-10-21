<script lang="ts">
	import CategoryImplementation from './git-source-history/ThreadHistory.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
