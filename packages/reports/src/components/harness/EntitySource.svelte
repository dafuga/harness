<script lang="ts" module>
	import type { HarnessUnit } from '../../models/Harness.types';
	import type { SourceFiles, SourceRead } from '../../lib/stores/sourceReader.svelte';
	/**
	 * The files archived with exactly this revision of a unit, read from the host's media. Nothing
	 * is read from a working copy and nothing stands in for a file the archive does not hold.
	 */
	export function archivedSource(unit: HarnessUnit, mediaBase: string, helperName?: string) {
		const archived = unit.sourceFiles;
		const helper =
			unit.helpers?.find((item) => item.name === helperName) ??
			(unit.helpers?.length === 1 ? unit.helpers[0] : undefined);
		const files: SourceFiles = async () => {
			const paths = (archived ?? []).map((file) => file.path);
			return helper && paths.includes(helper.source)
				? [helper.source, ...paths.filter((path) => path !== helper.source)]
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
	import SourceContent from '../SourceContent.svelte';
	// Mounted only when a person opens Source; other tabs keep ownership paths out of view.
	let {
		unit,
		mediaBase = '',
		commit = ''
	}: {
		unit: HarnessUnit;
		mediaBase?: string;
		/** The revision the code was archived at: a removed unit's last commit, not its removal. */
		commit?: string;
	} = $props();
	let source = $derived(archivedSource(unit, mediaBase));
</script>

<div class="ex-stack">
	<section class="ex-card" aria-labelledby="ex-source-title">
		<h2 id="ex-source-title">Source ownership</h2>
		<p class="ex-soft">The files and symbols this entity owns at this revision.</p>
		<div class="ex-config">
			<div>
				<h3>Files</h3>
				{#if unit.owns.source.length === 0}<p class="ex-soft">It owns no file.</p>{/if}
				<ul class="ex-links ex-mono">
					{#each unit.owns.source as file, position (position)}<li>{file}</li>{/each}
				</ul>
			</div>
			<div>
				<h3>Symbols</h3>
				{#if unit.owns.symbols.length === 0}<p class="ex-soft">It names no symbol.</p>{/if}
				<ul class="ex-links ex-mono">
					{#each unit.owns.symbols as symbol, position (position)}<li>{symbol}</li>{/each}
				</ul>
			</div>
			<div>
				<h3>Execution targets</h3>
				<ul class="ex-links ex-mono">
					{#each unit.runtime.targets as target, position (position)}
						<li>{target.kind} · {target.entry}</li>
					{/each}
				</ul>
			</div>
		</div>
		<p class="ex-note">Identity {unit.id} · version {unit.version}</p>
	</section>
	<section class="ex-card" aria-labelledby="ex-source-code-title">
		<h2 id="ex-source-code-title">Source code</h2>
		<SourceContent files={source.files} read={source.read} {commit} empty={source.empty} />
	</section>
</div>
