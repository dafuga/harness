<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_nh2zh6tsrc -->
<script lang="ts">
	import Notice from '$shared/explorer-ui/explorer-kit/Notice.svelte';
	import ComparePanes from '$shared/shared-primitives/ComparePanes.svelte';
	import { comparisonPanes } from '$reports/helpers/verification-evidence/comparisonPanes';
	import { shortCommit } from '$reports/helpers/strings/shortCommit';

	import Select from '$shared/Select.svelte';

	import {
		entityScreens,
		screenPick,
		type ScreenOption,
		type ScreenPick
	} from '$reports/utils/explorer-ui/entityScreens';
	import type { EntityEvidence } from '../../lib/stores/explorer-ui/entityEvidence.svelte';
	import type { EntityEvidenceResult } from '../../models/verification-evidence/DesktopEvidence.types';
	import RuntimePane from './RuntimePane.svelte';
	import SegmentedChoice from '../shared-primitives/SegmentedChoice.svelte';
	import Status from '$shared/shared-primitives/status/Status.svelte';
	let {
		result,
		options,
		evidence
	}: {
		result: EntityEvidenceResult;
		/** The scenarios that show the entity, with the states and viewports each declares. */
		options: ScreenOption[];
		evidence: EntityEvidence;
	} = $props();
	let wanted = $state<Partial<ScreenPick>>({});
	const pick = $derived(screenPick(options, wanted));
	const option = $derived(options.find((item) => item.scenario === pick?.scenario));
	/** Which capture stands on each side is decided by the reports explorer, not here. */
	const shown = $derived(entityScreens(result.evidence, pick));
	const paired = $derived(result.evidence.mode === 'commit');
	const unlike = $derived(paired ? result.evidence.incomparable : []);
	const panes = $derived(
		comparisonPanes(
			{ value: shown.before, commit: result.scope.parent },
			{
				value: shown.after,
				commit: result.scope.commit,
				currentRole: shown.origin ? `Inherited from ${shortCommit(shown.origin)}` : 'Branch tip'
			},
			paired
		)
	);
	const size = $derived(option?.viewports.find((item) => item.id === pick?.viewport)?.size ?? '');
	const choose = (changed: Partial<ScreenPick>) => (wanted = { ...pick, ...changed });
	const title = $derived.by(() => {
		if (!paired) return 'Current screenshot';
		return unlike.length ? 'Before and after, not alike' : 'Before and after';
	});
	/**
	 * What the one pane of a branch tip is. It is recorded for the tip; where the capture itself
	 * was made is said only as the record says it, so an inherited one names its own commit.
	 */
	const recorded = $derived.by(() => {
		const at = shortCommit(result.scope.commit);
		if (shown.origin)
			return `Recorded for ${at}. The capture was made at ${shortCommit(shown.origin)} and is inherited.`;
		return shown.fresh
			? `Recorded for ${at} and captured from the build of that commit.`
			: `Recorded for ${at}; no capture of this state stands for it.`;
	});
</script>

<hx-div class="runtime-card">
	<hx-h3>{title}</hx-h3>
	<hx-p class="muted">
		{#if !paired}{recorded}
		{:else if unlike.length}The two sides were not recorded alike, so they are not compared.
		{:else}The same scenario, state and viewport at the parent and at the commit.{/if}
	</hx-p>
	{#if unlike.length}<Notice
			as="ul"
			role="list"
			className="runtime-gap"
			label="Why the two sides are not compared"
		>
			{#each unlike as reason (reason)}<hx-li>
					<Status variant="icon" status="failed" reason="Not comparable" /><hx-span
						>{reason}</hx-span
					>
				</hx-li>{/each}
		</Notice>{/if}
	{#if pick && option}<hx-div class="runtime-controls">
			<hx-label
				>Scenario<Select
					label="Scenario"
					disabled={options.length < 2}
					bind:value={() => pick?.scenario ?? '', (scenario) => choose({ scenario })}
					>{#each options as item (item.scenario)}<hx-option value={item.scenario}
							>{item.title}</hx-option
						>{/each}</Select
				></hx-label
			><hx-label
				>State<Select
					label="State"
					bind:value={() => pick?.state ?? '', (state) => choose({ state })}
					>{#each option.states as id (id)}<hx-option value={id}>{id}</hx-option>{/each}</Select
				></hx-label
			><SegmentedChoice
				label="Viewport"
				options={option.viewports.map((item) => item.id)}
				bind:value={() => pick?.viewport ?? '', (viewport) => choose({ viewport })}
			/><hx-small>{size}</hx-small>
		</hx-div>{/if}
	{#if options.length === 1}<hx-p class="muted">One recorded scenario</hx-p>{/if}
	<ComparePanes {panes} className="runtime-panes" framed={false}>
		{#snippet children(pane)}<RuntimePane
				item={pane.value!}
				{evidence}
				title={pane.heading}
				role={pane.role}
			/>{/snippet}
	</ComparePanes>
</hx-div>

<style>
	.runtime-card :global(p.runtime-gap),
	:global(.runtime-gap li) {
		flex-wrap: nowrap;
	}
	.runtime-card :global(p.runtime-gap > .verification-wrap),
	:global(.runtime-gap li > .verification-wrap) {
		flex: none;
	}
</style>
