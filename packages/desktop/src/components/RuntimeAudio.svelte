<script lang="ts">
	import type { Evidence } from '../../../reports/src/models/Report.types';
	import { galleryItems } from '../../../reports/src/utils/entityScreens';
	import type { EntityEvidence } from '../lib/stores/entityEvidence.svelte';
	import type { EntityEvidenceResult } from '../models/DesktopEvidence.types';
	import StatusIcon from './StatusIcon.svelte';
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

{#if declared || clips.length}<div class="runtime-card">
		<h3>{paired ? 'Audio before and after' : 'Current audio'}</h3>
		{#each pairs as pair (pair.key)}<div class="runtime-panes" class:paired>
				{#each sides as side (side)}{@const clip = pair[side]}
					<div
						class="runtime-pane"
						role="group"
						aria-label={`${side === 'before' ? 'Before' : paired ? 'After' : 'Current'} · ${at(side)}`}
					>
						{#if clip}{#await evidence.url(side, clip.file)}<p class="muted">Reading the clip…</p>
							{:then url}<audio controls src={url} aria-label={clip.title}></audio>{:catch cause}<p
									class="runtime-gap"
								>
									<StatusIcon status="failed" reason="Not verified" /><span>{words(cause)}</span>
								</p>{/await}{#if clip.transcript}<p class="runtime-transcript">
									{clip.transcript}
								</p>{/if}
							<p class="runtime-standing">{clip.standing} · {clip.status}</p>{:else}<p
								class="runtime-gap"
							>
								<StatusIcon status="failed" reason="No clip" /><span
									>No clip of this state is recorded for {at(side)}.</span
								>
							</p>{/if}
					</div>{/each}
			</div>{:else}<p class="runtime-gap">
				<StatusIcon status="failed" reason="No clip" /><span
					>A clip is declared for this entity, and none is recorded at {at('after')}.</span
				>
			</p>{/each}
	</div>{/if}
