<script lang="ts" module>
	export { archivedSource } from '../../lib/explorer-ui/stores/sourceReader.svelte';
</script>

<script lang="ts">
	import { implementationFiles, testFiles } from '../../lib/explorer-ui/stores/sourceReader.svelte';
	import type { HarnessUnit } from '../../models/explorer-ui/Harness.types';
	import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';
	import type { EntityNav } from '../../utils/explorer-ui/entityLens';
	import SourceCodeAction from './SourceCodeAction.svelte';
	import SourceFileList from './SourceFileList.svelte';
	let {
		unit,
		repository,
		commit,
		entity,
		nav
	}: {
		unit: HarnessUnit;
		repository?: string;
		commit?: string;
		entity?: ExplorerEntity;
		nav?: EntityNav;
	} = $props();
	let files = $derived(implementationFiles(unit));
	let tests = $derived(testFiles(unit));
	function sourceLink(file: string): string | undefined {
		if (!repository || !/^https:\/\/github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(repository))
			return;
		if (!commit || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) return;
		const parts = file.split('/');
		if (file.includes('\\') || parts.some((part) => !part || part === '.' || part === '..')) return;
		return `${repository}/blob/${commit}/${parts.map(encodeURIComponent).join('/')}`;
	}
</script>

<section
	class="ex-card"
	aria-labelledby="ex-source-title"
	data-harness-component="harness-entity-source"
>
	<h2 id="ex-source-title">Source files</h2>
	<SourceFileList
		{files}
		href={sourceLink}
		relativeTo={unit.kind === 'service' ? 'src/services/' : ''}
	>
		{#snippet children(path)}
			{#if entity && nav}<SourceCodeAction {entity} {nav} {path} />{/if}
		{/snippet}
	</SourceFileList>
	<h2 class="source-tests-title">Test files</h2>
	<SourceFileList
		files={tests}
		label="Test files"
		empty="No test files recorded at this revision."
		href={sourceLink}
	>
		{#snippet children(path)}
			{#if entity && nav}<SourceCodeAction {entity} {nav} {path} />{/if}
		{/snippet}
	</SourceFileList>
	{#if !files.some((file) => sourceLink(file))}<p class="ex-soft">
			GitHub source unavailable for this revision.
		</p>{/if}
</section>

<style>
	.source-tests-title {
		margin-top: var(--hx-space-28);
	}
</style>
