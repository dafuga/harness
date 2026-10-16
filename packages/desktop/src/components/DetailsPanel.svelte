<script lang="ts">
	import type { EntityDetail } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
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

<section class="panel">
	<h2>Details</h2>
	<dl>
		<dt>Kind</dt>
		<dd>{entity.kind}</dd>
		<dt>Size</dt>
		<dd>{entity.size.available ? entity.size.text : entity.size.text || 'Not measured'}</dd>
		<dt>Performance</dt>
		<dd>
			{entity.performance.available
				? entity.performance.text
				: entity.performance.text || 'Not measured'}
		</dd>
	</dl>
	<details>
		<summary>Source</summary>
		<div class="source-list">
			{#each entity.sources as path (path)}<button
					class:active={path === selected}
					onclick={() => void read(path)}>{path}</button
				>{:else}<p>No source files recorded.</p>{/each}
		</div>
		{#if error}<p role="alert">{error}</p>{/if}{#if selected}<pre aria-label={selected}><code
					>{source}</code
				></pre>{/if}
	</details>
</section>
