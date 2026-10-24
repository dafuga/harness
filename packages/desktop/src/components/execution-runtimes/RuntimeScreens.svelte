<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Evidence } from '../../../../reports/src/models/Report.types';
	import {
		entityScreens,
		screenPick,
		type ScreenOption,
		type ScreenPick
	} from '../../../../reports/src/utils/entityScreens';
	import type { EntityEvidence } from '../../lib/stores/explorer-ui/entityEvidence.svelte';
	import type { EntityEvidenceResult } from '../../models/verification-evidence/DesktopEvidence.types';
	import RuntimePane from './RuntimePane.svelte';
	import SegmentedChoice from '../shared-primitives/SegmentedChoice.svelte';
	import StatusIcon from '../shared-primitives/StatusIcon.svelte';
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
	const short = (commit: string) => commit.slice(0, 7);
	let wanted = $state<Partial<ScreenPick>>({});
	const pick = $derived(screenPick(options, wanted));
	const option = $derived(options.find((item) => item.scenario === pick?.scenario));
	/** Which capture stands on each side is decided by the reports explorer, not here. */
	const shown = $derived(entityScreens(result.evidence, pick));
	const paired = $derived(result.evidence.mode === 'commit');
	const unlike = $derived(paired ? result.evidence.incomparable : []);
	const panes = $derived([...(shown.before ? [shown.before] : []), shown.after]);
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
		const at = short(result.scope.commit);
		if (shown.origin)
			return `Recorded for ${at}. The capture was made at ${short(shown.origin)} and is inherited.`;
		return shown.fresh
			? `Recorded for ${at} and captured from the build of that commit.`
			: `Recorded for ${at}; no capture of this state stands for it.`;
	});
	/** Who a pane is: the parent, the named commit, or the one capture of the branch tip. */
	function heading(item: Evidence): { title: string; role: string } {
		const { commit, parent } = result.scope;
		if (item.phase === 'before')
			return { title: `Before · ${short(parent ?? '')}`, role: 'Parent commit' };
		if (paired) return { title: `After · ${short(commit)}`, role: 'Selected commit' };
		const role = shown.origin ? `Inherited from ${short(shown.origin)}` : 'Branch tip';
		return { title: `Current snapshot · ${short(commit)}`, role };
	}
</script>

<hx-div class="runtime-card">
	<hx-h3>{title}</hx-h3>
	<hx-p class="muted">
		{#if !paired}{recorded}
		{:else if unlike.length}The two sides were not recorded alike, so they are not compared.
		{:else}The same scenario, state and viewport at the parent and at the commit.{/if}
	</hx-p>
	{#if unlike.length}<hx-ul class="runtime-gap" aria-label="Why the two sides are not compared">
			{#each unlike as reason (reason)}<hx-li>
					<StatusIcon status="failed" reason="Not comparable" /><hx-span>{reason}</hx-span>
				</hx-li>{/each}
		</hx-ul>{/if}
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
	<hx-div class="runtime-panes" class:paired>
		{#each panes as item (item.id)}<RuntimePane {item} {evidence} {...heading(item)} />{/each}
	</hx-div>
</hx-div>
