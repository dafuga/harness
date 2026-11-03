<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_3gdr6c3isc -->
<script lang="ts">
	import Notice from '$shared/explorer-ui/explorer-kit/Notice.svelte';
	import ComparePanes from '$shared/shared-primitives/ComparePanes.svelte';
	import { comparisonPanes } from '$reports/helpers/verification-evidence/comparisonPanes';
	import { errorMessage } from '$reports/helpers/strings/errorMessage';

	import { shortCommit } from '$reports/helpers/strings/shortCommit';

	import type { Evidence } from '$reports/models/reports-media/Report.types';
	import { galleryItems } from '$reports/utils/explorer-ui/entityScreens';
	import type { EntityEvidence } from '../../lib/stores/explorer-ui/entityEvidence.svelte';
	import type { EntityEvidenceResult } from '../../models/verification-evidence/DesktopEvidence.types';
	import Status from '$shared/shared-primitives/status/Status.svelte';
	let { result, evidence }: { result: EntityEvidenceResult; evidence: EntityEvidence } = $props();

	const clips = $derived(
		galleryItems(result.evidence).filter((item) => item.mediaType === 'audio')
	);
	/** A scenario that covers the entity says that a clip belongs to it. */
	const declared = $derived(
		result.evidence.scenarios.some((scenario) =>
			(scenario.evidence ?? []).some((item) => item.kind === 'audio')
		)
	);
	const paired = $derived(result.evidence.mode === 'commit');
	/** A clip stands beside the clip of the same scenario, state and evidence on the other side. */
	const pairs = $derived(
		[...new Set(clips.map((item) => item.comparison))].map((key) => {
			const of = (phase: Evidence['phase']) =>
				clips.find((item) => item.comparison === key && item.phase === phase);
			return {
				key,
				panes: comparisonPanes(
					{ value: of('before'), commit: result.scope.parent },
					{
						value: of('after') ?? of('current'),
						commit: result.scope.commit,
						currentLabel: 'Current'
					},
					paired
				)
			};
		})
	);
</script>

{#if declared || clips.length}<hx-div class="runtime-card">
		<hx-h3>{paired ? 'Audio before and after' : 'Current audio'}</hx-h3>
		{#each pairs as pair (pair.key)}
			<ComparePanes
				panes={pair.panes}
				className="runtime-panes"
				paneClass="runtime-pane"
				headings={false}
			>
				{#snippet children(pane)}
					{@const clip = pane.value!}
					{#await evidence.url(pane.side, clip.file)}
						<hx-p class="muted">Reading the clip…</hx-p>
					{:then url}<hx-audio controls src={url} aria-label={clip.title}
						></hx-audio>{#if clip.transcript}<hx-p class="runtime-transcript"
								>{clip.transcript}</hx-p
							>{/if}<hx-p class="runtime-standing">{clip.standing} · {clip.status}</hx-p>
					{:catch cause}<Notice as="p" className="runtime-gap runtime-audio-runtime-gap"
							><Status variant="icon" status="failed" reason="Not verified" /><hx-span
								>{errorMessage(cause)}</hx-span
							></Notice
						>{/await}
				{/snippet}
				{#snippet gap(pane)}
					<Notice as="p" className="runtime-gap runtime-audio-runtime-gap"
						><Status variant="icon" status="failed" reason="No clip" /><hx-span
							>No clip of this state is recorded for {shortCommit(pane.commit)}.</hx-span
						></Notice
					>
				{/snippet}
			</ComparePanes>
		{:else}<Notice as="p" className="runtime-gap runtime-audio-runtime-gap"
				><Status variant="icon" status="failed" reason="No clip" /><hx-span
					>A clip is declared for this entity, and none is recorded at {shortCommit(
						result.scope.commit
					)}.</hx-span
				></Notice
			>{/each}
	</hx-div>{/if}

<style>
	/* The status glyph keeps its own width, so its message sits beside it rather than across the card. */
	:global(p.runtime-audio-runtime-gap > span:first-child) {
		flex: none;
	}
</style>
