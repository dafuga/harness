<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { Evidence } from '../../../../reports/src/models/Report.types';
	import { galleryItems } from '../../../../reports/src/utils/entityScreens';
	import type { EntityEvidence } from '../../lib/stores/explorer-ui/entityEvidence.svelte';
	import type { EntityEvidenceResult } from '../../models/verification-evidence/DesktopEvidence.types';
	import StatusIcon from '../shared-primitives/StatusIcon.svelte';
	let { result, evidence }: { result: EntityEvidenceResult; evidence: EntityEvidence } = $props();
	const short = (commit: string) => commit.slice(0, 7);
	const words = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));
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
			return { key, before: of('before'), after: of('after') ?? of('current') };
		})
	);
	const sides = $derived(paired ? (['before', 'after'] as const) : (['after'] as const));
	const at = (side: 'before' | 'after') =>
		short(side === 'before' ? (result.scope.parent ?? '') : result.scope.commit);
</script>

{#if declared || clips.length}<hx-div class="runtime-card">
		<hx-h3>{paired ? 'Audio before and after' : 'Current audio'}</hx-h3>
		{#each pairs as pair (pair.key)}<hx-div class="runtime-panes" class:paired>
				{#each sides as side (side)}{@const clip = pair[side]}
					<hx-div
						class="runtime-pane"
						role="group"
						aria-label={`${side === 'before' ? 'Before' : paired ? 'After' : 'Current'} · ${at(side)}`}
					>
						{#if clip}{#await evidence.url(side, clip.file)}<hx-p class="muted"
									>Reading the clip…</hx-p
								>
							{:then url}<hx-audio controls src={url} aria-label={clip.title}
								></hx-audio>{:catch cause}<hx-p class="runtime-gap">
									<StatusIcon status="failed" reason="Not verified" /><hx-span
										>{words(cause)}</hx-span
									>
								</hx-p>{/await}{#if clip.transcript}<hx-p class="runtime-transcript">
									{clip.transcript}
								</hx-p>{/if}
							<hx-p class="runtime-standing">{clip.standing} · {clip.status}</hx-p>{:else}<hx-p
								class="runtime-gap"
							>
								<StatusIcon status="failed" reason="No clip" /><hx-span
									>No clip of this state is recorded for {at(side)}.</hx-span
								>
							</hx-p>{/if}
					</hx-div>{/each}
			</hx-div>{:else}<hx-p class="runtime-gap">
				<StatusIcon status="failed" reason="No clip" /><hx-span
					>A clip is declared for this entity, and none is recorded at {at('after')}.</hx-span
				>
			</hx-p>{/each}
	</hx-div>{/if}
