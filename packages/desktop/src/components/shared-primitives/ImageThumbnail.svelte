<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { imageUrl } from '../../utils/development-tooling/imageUrl';
	let {
		workspace,
		entityId,
		version,
		sha256,
		title
	}: { workspace: Workspace; entityId: string; version: string; sha256: string; title: string } =
		$props();
	let url = $state('');
	$effect(() => imageUrl(workspace, { entityId, version, sha256 }, (value) => (url = value)));
</script>

{#if url}<hx-img class="version-thumbnail" src={url} alt={title} />{:else}<hx-span class="muted"
		>Preview unavailable</hx-span
	>{/if}
