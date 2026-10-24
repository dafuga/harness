<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { Pair } from './EntityAudio.types';

	import type { ExplorerEvidence, ExplorerScope } from '../../models/explorer-ui/Explorer.types';
	import type { Evidence } from '../../models/reports-media/Report.types';
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import { galleryItems } from '../../utils/explorer-ui/entityScreens';
	import AudioEvidence from '../verification-evidence/AudioEvidence.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
	let {
		evidence,
		scope,
		mediaBase,
		empty = false
	}: {
		evidence: ExplorerEvidence;
		scope: ExplorerScope;
		mediaBase: string;
		empty?: boolean;
	} = $props();
	let clips = $derived(galleryItems(evidence).filter((item) => item.mediaType === 'audio'));
	let paired = $derived(evidence.mode === 'commit');
	// A clip stands beside the clip of the same scenario, state and evidence on the other side.
	let pairs = $derived(
		[...new Set(clips.map((item) => item.comparison))].map((key): Pair => {
			const of = (phase: Evidence['phase']) =>
				clips.find((item) => item.comparison === key && item.phase === phase);
			return { before: of('before'), after: of('after') ?? of('current') };
		})
	);
	const sides = [
		{ phase: 'before' as const, title: 'Before', role: 'Parent commit' },
		{ phase: 'after' as const, title: 'After', role: 'Selected commit' }
	];
	// At the branch tip there is one side, and it is never called before or after.
	let shown = $derived(paired ? sides : sides.slice(1));
	const at = (phase: 'before' | 'after') =>
		shortCommit(phase === 'before' ? (scope.parent ?? '') : scope.commit);
</script>

{#if clips.length}
	<hx-section
		class="ex-card ex-evidence"
		aria-labelledby="ex-audio-title"
		data-harness-component="harness-entity-audio"
	>
		<hx-header class="ex-evidence-head">
			<hx-div>
				<hx-h2 id="ex-audio-title">{paired ? 'Audio comparison' : 'Current audio'}</hx-h2>
				<hx-p class="ex-soft">
					{paired
						? 'The same clip before and after the selected commit, each with its transcript.'
						: `What was recorded at the current branch tip · ${shortCommit(scope.commit)}`}
				</hx-p>
			</hx-div>
		</hx-header>
		{#each pairs as pair, position (position)}
			<hx-div class="ex-panes" class:paired>
				{#each shown as side}
					{@const clip = pair[side.phase]}
					<hx-div class="ex-pane" role="group" aria-label={`${side.title} · ${at(side.phase)}`}>
						{#if paired}
							<hx-p class="ex-pane-head">
								<hx-strong>{side.title} · {at(side.phase)}</hx-strong>
								<hx-span class="ex-pill">{side.role}</hx-span>
							</hx-p>
						{/if}
						{#if clip}
							<AudioEvidence item={clip} assetBase={mediaBase} idPrefix="overview-audio-" />
						{:else}
							<hx-p class="ex-gap">
								<HarnessVerdict passed={false} label="No clip" />
								<hx-span>No clip of this state is recorded for {at(side.phase)}.</hx-span>
							</hx-p>
						{/if}
					</hx-div>
				{/each}
			</hx-div>
		{/each}
	</hx-section>
{:else if empty}
	<hx-section
		class="ex-card ex-evidence"
		aria-labelledby="ex-audio-title"
		data-harness-component="harness-entity-audio"
	>
		<hx-h2 id="ex-audio-title">Audio evidence</hx-h2>
		<hx-p class="ex-soft">No audio evidence is recorded for this component at this revision.</hx-p>
	</hx-section>
{/if}
