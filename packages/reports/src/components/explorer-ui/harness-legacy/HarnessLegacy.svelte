<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { HarnessLegacyReport } from '../../../models/explorer-ui/Harness.types';
	import { legacyEvidence, legacyLink } from './legacyEvidence';
	import EvidenceGrid from '../../verification-evidence/evidence-grid/EvidenceGrid.svelte';
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

<hx-section class="hc-card" aria-label="Earlier reports">
	<hx-h2>Earlier reports</hx-h2>
	<hx-p class="hc-muted">
		Reports made before verification was kept in Git, with their original outcome and date. None of
		them is a verification record, and none of their files is tied to a build.
	</hx-p>
	<hx-ul class="hc-records" aria-label="Earlier reports">
		{#each ordered as report (report.id)}
			<hx-li class:current={report.linked === commit}>
				<hx-strong>{report.title}</hx-strong>
				<hx-span class="badge {report.status}"
					><hx-span aria-hidden="true">●</hx-span> {status(report.status)}</hx-span
				>
				<hx-span class="hc-muted"
					>{report.startedAt.slice(0, 10)} · {report.environment} · {legacyLink(
						report,
						commit
					)}</hx-span
				>
				{#if report.linked && report.linked !== commit && known.has(report.linked)}
					<hx-button type="button" class="hc-chip" onclick={() => onselect(report.linked ?? commit)}
						>Show commit {report.linked.slice(0, 7)}</hx-button
					>
				{/if}
				{#if report.media.length}
					<hx-button
						type="button"
						class="hc-chip"
						aria-expanded={opened === report.id}
						onclick={() => (opened = opened === report.id ? null : report.id)}
						>{opened === report.id ? 'Hide its evidence' : 'Show its evidence'}</hx-button
					>
				{/if}
				<hx-details>
					<hx-summary>Summary and {report.checks.length} checks</hx-summary>
					<hx-p>{report.summary}</hx-p>
					<hx-div class="hc-failures">
						{#each report.checks as check, position (position)}<hx-p>
								{check.title}: {check.status}
							</hx-p>{/each}
					</hx-div>
				</hx-details>
			</hx-li>
		{/each}
	</hx-ul>
	{#if shown}
		{#key shown.id}<EvidenceGrid
				items={legacyEvidence(shown)}
				assetBase={mediaBase}
				idPrefix="legacy-"
			/>{/key}
	{/if}
</hx-section>
