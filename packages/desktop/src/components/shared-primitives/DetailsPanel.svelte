<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { EntityDetail } from '../../models/development-tooling/Desktop.types';
	import type { Workspace } from '../../lib/stores/projects-sessions/workspace.svelte';
	let { entity, workspace }: { entity: EntityDetail; workspace: Workspace } = $props();
	let source = $state('');
	let error = $state('');
	let selected = $state('');
	async function read(path: string) {
		selected = path;
		source = '';
		error = '';
		try {
			source = (
				await workspace.bridge!.source({
					entityId: entity.id,
					commit: workspace.snapshot!.revision.commit,
					path,
					...workspace.context
				})
			).text;
		} catch (cause) {
			error = String(cause);
		}
	}
</script>

<hx-section class="panel">
	<hx-h2>Source files</hx-h2>
	<hx-div class="source-list">
		{#each entity.sources as path (path)}<hx-button
				class:active={path === selected}
				onclick={() => void read(path)}>{path}</hx-button
			>{:else}<hx-p>No source files recorded.</hx-p>{/each}
	</hx-div>
	{#if error}<hx-p role="alert">{error}</hx-p>{/if}{#if selected}<hx-pre aria-label={selected}
			><hx-code>{source}</hx-code></hx-pre
		>{/if}
</hx-section>
