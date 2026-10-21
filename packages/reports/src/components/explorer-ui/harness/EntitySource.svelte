<script lang="ts" module>
	import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';
	import type { SourceFiles, SourceRead } from '../../../lib/explorer-ui/stores/sourceReader.svelte';

	/** Keep actual category implementations, with recorded addresses for older revisions. */
	function implementationFiles(unit: HarnessUnit): string[] {
		const archived = unit.sourceFiles;
		const source: string[] = [];
		const length = archived?.length ?? unit.owns.source.length;
		for (let position = 0; position < length; position++)
			source.push(archived ? archived[position].path : unit.owns.source[position]);
		if (!unit.group) return source;
		const categorized: string[] = [];
		for (let position = 0; position < source.length; position++) {
			const path = source[position];
			if (path.split('/').includes(unit.group.id)) categorized.push(path);
		}
		return categorized.length ? categorized : source;
	}

	/** Read only text archived with this revision; never substitute a working-copy file. */
	export function archivedSource(unit: HarnessUnit, mediaBase: string, filePath?: string) {
		const archived = unit.sourceFiles;
		const files: SourceFiles = async () => {
			const paths = archived ? implementationFiles(unit) : [];
			return filePath && paths.includes(filePath)
				? [filePath, ...paths.filter((path) => path !== filePath)]
				: paths;
		};
		const read: SourceRead = async (path) => {
			const file = archived?.find((entry) => entry.path === path);
			if (!file?.media) throw new Error(file?.gap ?? `${path} is not archived at this revision.`);
			if (!/^media\/[a-f0-9]{64}\.txt$/.test(file.media))
				throw new Error('The recorded source reference is invalid.');
			const response = await fetch(mediaBase + file.media.slice('media/'.length));
			if (!response.ok) throw new Error(`${path} could not be read (${response.status}).`);
			return await response.text();
		};
		const empty = archived ? undefined : 'Source contents are not recorded for this revision.';
		return { files, read, empty };
	}
</script>

<script lang="ts">
	import type { ExplorerEntity } from '../../../models/explorer-ui/Explorer.types';
	import type { EntityNav } from '../../../utils/explorer-ui/entityLens';
	import SourceCodeAction from '../SourceCodeAction.svelte';
	import SourceFileList from '../SourceFileList.svelte';
	let { unit, repository, commit, entity, nav }: {
		unit: HarnessUnit;
		repository?: string;
		commit?: string;
		entity?: ExplorerEntity;
		nav?: EntityNav;
	} = $props();
	let files = $derived(implementationFiles(unit));
	function sourceLink(file: string): string | undefined {
		if (!repository || !/^https:\/\/github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return;
		if (!commit || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) return;
		const parts = file.split('/');
		if (file.includes('\\') || parts.some((part) => !part || part === '.' || part === '..')) return;
		return `${repository}/blob/${commit}/${parts.map(encodeURIComponent).join('/')}`;
	}
</script>

<section class="ex-card" aria-labelledby="ex-source-title">
	<h2 id="ex-source-title">Source files</h2>
	<SourceFileList {files} href={sourceLink}>
		{#snippet children(path)}
			{#if entity && nav}<SourceCodeAction {entity} {nav} {path} />{/if}
		{/snippet}
	</SourceFileList>
	{#if !files.some((file) => sourceLink(file))}<p class="ex-soft">GitHub source unavailable for this revision.</p>{/if}
</section>
