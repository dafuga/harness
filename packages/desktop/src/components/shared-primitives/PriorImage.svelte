<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_3v7bhubg2r -->
<script lang="ts">
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	import { imageUrl } from '../../utils/reports-media/imageUrl';
	let {
		workspace,
		entityId,
		version,
		sha256,
		title,
		caption = '',
		note = ''
	}: {
		workspace: Workspace;
		entityId: string;
		version: string;
		/** Empty when there is nothing before: the slot shows `note` instead of an image. */
		sha256: string;
		title: string;
		/** Replaces `Before · version`, e.g. for the current build a mockup is paired with. */
		caption?: string;
		note?: string;
	} = $props();
	let url = $state('');
	let error = $state('');
	$effect(() =>
		imageUrl(
			workspace,
			sha256 ? { entityId, version, sha256 } : null,
			(value, cause) => ([url, error] = [value, cause])
		)
	);
</script>

<!-- The image an after replaces. It is shown as it was and takes no comments. -->
<hx-figure class="prior-image">
	<hx-figcaption>{caption || `Before · ${version}`}</hx-figcaption>
	{#if !sha256}<hx-p class="empty">{note || 'No earlier image.'}</hx-p>{:else if url}<hx-img
			src={url}
			alt={title}
		/>{:else}<hx-p class="muted">{error || 'Loading earlier image…'}</hx-p>{/if}
</hx-figure>
