<script lang="ts">
	import type { HarnessUnit } from '../../models/Harness.types';
	let { unit, repository, commit }: { unit: HarnessUnit; repository?: string; commit: string } = $props();
	const links = $derived(unit.owns.source.flatMap((file) => {
		const href = sourceLink(file);
		return href ? [{ file, href }] : [];
	}));

	function sourceLink(file: string): string | undefined {
		if (!repository || !/^https:\/\/github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return;
		if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commit)) return;
		const parts = file.split('/');
		if (file.includes('\\') || parts.some((part) => !part || part === '.' || part === '..')) return;
		return `${repository}/blob/${commit}/${parts.map(encodeURIComponent).join('/')}`;
	}
</script>

<section class="ex-card" aria-label="GitHub source">
	{#if links.length}
		<ul class="ex-links ex-mono">
			{#each links as link, position (position)}
				<li><a href={link.href} target="_blank" rel="noopener noreferrer">{link.file}</a></li>
			{/each}
		</ul>
	{:else}
		<p class="ex-soft">GitHub source unavailable for this revision.</p>
	{/if}
</section>
