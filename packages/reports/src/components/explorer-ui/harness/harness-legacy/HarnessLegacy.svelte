<script lang="ts">
	import type { HarnessLegacyReport } from '../../../../models/explorer-ui/Harness.types';
	import { legacyEvidence, legacyLink } from './legacyEvidence';
	import EvidenceGrid from '../../../verification-evidence/evidence-grid/EvidenceGrid.svelte';
	let {
		reports,
		commit,
		known,
		mediaBase,
		onselect
	}: {
		reports: HarnessLegacyReport[];
		commit: string;
		/** Commits the index holds, so a link is offered only when it leads somewhere. */
		known: Set<string>;
		mediaBase: string;
		onselect: (commit: string) => void;
	} = $props();
	let opened = $state<string | null>(null);
	// Reports of the commit being looked at come first; the rest keep their recorded order.
	let ordered = $derived(
		[...reports].sort(
			(left, right) => Number(right.linked === commit) - Number(left.linked === commit)
		)
	);
	let shown = $derived(reports.find((report) => report.id === opened));
	const status = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
</script>

<section class="hc-card" aria-label="Earlier reports">
	<h2>Earlier reports</h2>
	<p class="hc-muted">
		Reports made before verification was kept in Git, with their original outcome and date. None of
		them is a verification record, and none of their files is tied to a build.
	</p>
	<ul class="hc-records" aria-label="Earlier reports">
		{#each ordered as report (report.id)}
			<li class:current={report.linked === commit}>
				<strong>{report.title}</strong>
				<span class="badge {report.status}"
					><span aria-hidden="true">●</span> {status(report.status)}</span
				>
				<span class="hc-muted"
					>{report.startedAt.slice(0, 10)} · {report.environment} · {legacyLink(
						report,
						commit
					)}</span
				>
				{#if report.linked && report.linked !== commit && known.has(report.linked)}
					<button type="button" class="hc-chip" onclick={() => onselect(report.linked ?? commit)}
						>Show commit {report.linked.slice(0, 7)}</button
					>
				{/if}
				{#if report.media.length}
					<button
						type="button"
						class="hc-chip"
						aria-expanded={opened === report.id}
						onclick={() => (opened = opened === report.id ? null : report.id)}
						>{opened === report.id ? 'Hide its evidence' : 'Show its evidence'}</button
					>
				{/if}
				<details>
					<summary>Summary and {report.checks.length} checks</summary>
					<p>{report.summary}</p>
					<div class="hc-failures">
						{#each report.checks as check, position (position)}<p>
								{check.title}: {check.status}
							</p>{/each}
					</div>
				</details>
			</li>
		{/each}
	</ul>
	{#if shown}
		{#key shown.id}<EvidenceGrid
				items={legacyEvidence(shown)}
				assetBase={mediaBase}
				idPrefix="legacy-"
			/>{/key}
	{/if}
</section>
