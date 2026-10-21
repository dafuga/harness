<script lang="ts" module>
	import type { HarnessUnit } from '../../models/Harness.types';
	import type { SourceFiles, SourceRead } from '../../lib/stores/sourceReader.svelte';
	/**
	 * The files archived with exactly this revision of a unit, read from the host's media. Nothing
	 * is read from a working copy and nothing stands in for a file the archive does not hold.
	 */
	export function archivedSource(unit: HarnessUnit, mediaBase: string, filePath?: string) {
		const archived = unit.sourceFiles;
		const files: SourceFiles = async () => {
			const paths = (archived ?? []).map((file) => file.path);
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
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import type { EntityNav } from '../../utils/entityLens';
	import SourceCodeAction from '../SourceCodeAction.svelte';
	import SourceFileList from '../SourceFileList.svelte';
	// Mounted only when a person opens Source; other tabs keep ownership paths out of view.
	let {
		entity,
		nav
	}: {
		entity: ExplorerEntity;
		nav: EntityNav;
	} = $props();
	let unit = $derived(entity.unit);
	let files = $derived(unit.sourceFiles?.map((file) => file.path) ?? unit.owns.source);
</script>

<section class="ex-card" aria-labelledby="ex-source-title">
	<h2 id="ex-source-title">Source files</h2>
	<SourceFileList {files} href={(path) => nav.fileHref?.(entity, path)}>
		{#snippet children(path)}<SourceCodeAction {entity} {nav} {path} />{/snippet}
	</SourceFileList>
</section>
