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

<!-- The committed image the viewed commit replaced. It is shown as it was and takes no comments. -->
<hx-figure class="prior-image">
	<hx-figcaption>Before · {version}</hx-figcaption>
	{#if url}<hx-img src={url} alt={title} />{:else}<hx-p class="muted">Loading earlier image…</hx-p
		>{/if}
</hx-figure>
