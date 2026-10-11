<script lang="ts">
	import type { Workspace } from '../lib/stores/workspace.svelte';
	let { workspace }: { workspace: Workspace } = $props();
</script>

<footer class="status-bar">
	<span
		>{workspace.busy
			? 'Loading project…'
			: workspace.snapshot?.writable
				? 'Local project'
				: 'Historical revision · read-only'}</span
	><span>{workspace.snapshot?.revision.commit.slice(0, 7)}</span>
</footer>
