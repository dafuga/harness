<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import ComparePanes from '../shared-primitives/ComparePanes.svelte';
	import { comparisonPanes } from '../../helpers/verification-evidence/comparisonPanes';
	import Card from './explorer-kit/Card.svelte';
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
			return {
				key,
				panes: comparisonPanes(
					{ value: of('before'), commit: scope.parent },
					{ value: of('after') ?? of('current'), commit: scope.commit, currentLabel: 'Current' },
					paired
				)
			};
		})
	);
</script>

{#if clips.length}
	<Card
		as="section"
		tone="ex-evidence"
		labelledby="ex-audio-title"
		component="harness-entity-audio"
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
		{#each pairs as pair (pair.key)}
			<ComparePanes panes={pair.panes} headings={paired}>
				{#snippet children(pane)}
					{#if pane.value}<AudioEvidence
							item={pane.value}
							assetBase={mediaBase}
							idPrefix="overview-audio-"
						/>{/if}
				{/snippet}
				{#snippet gap(pane)}
					<hx-p class="ex-gap"
						><HarnessVerdict passed={false} label="No clip" /><hx-span
							>No clip of this state is recorded for {shortCommit(pane.commit)}.</hx-span
						></hx-p
					>
				{/snippet}
			</ComparePanes>
		{/each}
	</Card>
{:else if empty}
	<Card
		as="section"
		tone="ex-evidence"
		labelledby="ex-audio-title"
		component="harness-entity-audio"
	>
		<hx-h2 id="ex-audio-title">Audio evidence</hx-h2>
		<hx-p class="ex-soft">No audio evidence is recorded for this component at this revision.</hx-p>
	</Card>
{/if}
