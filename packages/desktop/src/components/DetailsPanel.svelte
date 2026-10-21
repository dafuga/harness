<script lang="ts">
	import SourceContent from '../../../reports/src/components/SourceContent.svelte';
	import type { EntityDetail } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	let { entity, workspace }: { entity: EntityDetail; workspace: Workspace } = $props();
	/** The files of the selected commit, each read through the bridge for this entity and project. */
	let source = $derived.by(() => {
		const bridge = workspace.bridge;
		const commit = workspace.snapshot?.revision.commit ?? '';
		const query = { entityId: entity.id, commit, ...workspace.context };
		const listed = [...entity.sources];
		return {
			commit,
			files: async () => listed,
			read: async (path: string) => (await bridge!.source({ ...query, path })).text
		};
	});
</script>

<section class="panel">
	<h2>Source files</h2>
	<SourceContent files={source.files} read={source.read} commit={source.commit} />
</section>
