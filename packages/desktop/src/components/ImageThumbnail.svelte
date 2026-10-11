<script lang="ts">
	import type { Workspace } from '../lib/stores/workspace.svelte';
	let {
		workspace,
		entityId,
		version,
		sha256,
		title
	}: { workspace: Workspace; entityId: string; version: string; sha256: string; title: string } =
		$props();
	let url = $state('');
	$effect(() => {
		let disposed = false;
		let objectUrl = '';
		url = '';
		if (workspace.bridge && workspace.snapshot)
			void workspace.bridge
				.image({ entityId, version, sha256, commit: workspace.snapshot.revision.commit })
				.then((bytes) => {
					objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
					if (!disposed) url = objectUrl;
					else URL.revokeObjectURL(objectUrl);
				})
				.catch(() => {});
		return () => {
			disposed = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	});
</script>

{#if url}<img class="version-thumbnail" src={url} alt={title} />{:else}<span class="muted"
		>Preview unavailable</span
	>{/if}
