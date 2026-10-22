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

<!-- The committed image the viewed commit replaced. It is shown as it was and takes no comments. -->
<figure class="prior-image">
	<figcaption>Before · {version}</figcaption>
	{#if url}<img src={url} alt={title} />{:else}<p class="muted">Loading earlier image…</p>{/if}
</figure>
