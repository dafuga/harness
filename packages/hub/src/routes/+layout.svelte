<!-- @harness-tier layout -->
<!-- @harness-atoms ../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import '$desktop/lib/styles/workspace.css';
	import '$desktop/lib/styles/design.css';
	import '../lib/styles/hub.css';
	import { provideBrowser } from './browserContext';
	let { children }: { children: Snippet } = $props();
	const { session } = provideBrowser();
	onMount(() => void session.refresh());
</script>

{@render children()}
