<script lang="ts">
	import type { HarnessUnit } from '../../../models/explorer-ui/Harness.types';
	// Mounted only when a person opens Source; other tabs keep ownership paths out of view.
	let { unit, repository, commit }: { unit: HarnessUnit; repository?: string; commit?: string } = $props();
	let files = $derived.by(() => {
		const source = unit.owns.source;
		const group = unit.group;
		if (!group) return source;
		const categorized: string[] = [];
		for (let position = 0; position < source.length; position++) {
			const file = source[position];
			if (file.split('/').includes(group.id)) categorized.push(file);
		}
		// Framework entries and older revisions keep their actual recorded addresses.
		return categorized.length ? categorized : source;
	});
	function sourceLink(file: string): string | undefined {
		if (!repository || !/^https:\/\/github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return;
		if (!commit || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) return;
		const parts = file.split('/');
		if (file.includes('\\') || parts.some((part) => !part || part === '.' || part === '..')) return;
		return `${repository}/blob/${commit}/${parts.map(encodeURIComponent).join('/')}`;
	}
</script>

<section class="ex-card" aria-labelledby="ex-source-title">
	<h2 id="ex-source-title">Source ownership</h2>
	<p class="ex-soft">The implementation files at this revision.</p>
	<div class="ex-config">
		<div>
			<h3>Files</h3>
			{#if files.length === 0}<p class="ex-soft">It owns no file.</p>{/if}
			<ul class="ex-links ex-mono">
				{#each files as file, position (position)}
					{@const href = sourceLink(file)}
					<li>{#if href}<a {href} target="_blank" rel="noopener noreferrer">{file}</a>{:else}{file}{/if}</li>
				{/each}
			</ul>
			{#if !files.some((file) => sourceLink(file))}<p class="ex-soft">GitHub source unavailable for this revision.</p>{/if}
		</div>
	</div>
</section>
