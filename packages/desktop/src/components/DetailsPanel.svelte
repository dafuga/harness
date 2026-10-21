<script lang="ts">
	import EntitySourceAction from './EntitySourceAction.svelte';
	import SourceFileList from '../../../reports/src/components/SourceFileList.svelte';
	import { githubSourceUrl } from '../../../../src/utils/githubSourceUrl';
	import type { EntityDetail } from '../models/Desktop.types';
	import type { Workspace } from '../lib/stores/workspace.svelte';
	let { entity, workspace, title }: { entity: EntityDetail; workspace: Workspace; title: string } =
		$props();
	let snapshot = $derived(workspace.snapshot);
</script>

<section class="panel">
	<h2>Source files</h2>
	<SourceFileList
		files={entity.sources}
		href={(path) =>
			githubSourceUrl(snapshot?.project.repositoryUrl, snapshot?.revision.commit ?? '', path)}
	>
		{#snippet children(path)}<EntitySourceAction {entity} {workspace} {title} {path} />{/snippet}
	</SourceFileList>
</section>
