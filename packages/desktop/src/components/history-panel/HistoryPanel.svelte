<script lang="ts">
	import CategoryImplementation from '../git-source-history/history-panel/HistoryPanel.svelte';
	import type { ComponentProps } from 'svelte';
	let props: ComponentProps<typeof CategoryImplementation> = $props();
</script>

<CategoryImplementation {...props} />
