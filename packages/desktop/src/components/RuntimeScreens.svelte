<script lang="ts">
	import Select from '$shared/Select.svelte';
	import type { Evidence } from '../../../reports/src/models/Report.types';
	import {
		entityScreens,
		screenPick,
		type ScreenOption,
		type ScreenPick
	} from '../../../reports/src/utils/entityScreens';
	import type { EntityEvidence } from '../lib/stores/entityEvidence.svelte';
	import type { EntityEvidenceResult } from '../models/DesktopEvidence.types';
	import RuntimePane from './RuntimePane.svelte';
	import SegmentedChoice from './SegmentedChoice.svelte';
	import StatusIcon from './StatusIcon.svelte';
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

<div class="runtime-card">
	<h3>{title}</h3>
	<p class="muted">
		{#if !paired}{recorded}
		{:else if unlike.length}The two sides were not recorded alike, so they are not compared.
		{:else}The same scenario, state and viewport at the parent and at the commit.{/if}
	</p>
	{#if unlike.length}<ul class="runtime-gap" aria-label="Why the two sides are not compared">
			{#each unlike as reason (reason)}<li>
					<StatusIcon status="failed" reason="Not comparable" /><span>{reason}</span>
				</li>{/each}
		</ul>{/if}
	{#if pick && option}<div class="runtime-controls">
			<label
				>Scenario<Select
					label="Scenario"
					disabled={options.length < 2}
					bind:value={() => pick?.scenario ?? '', (scenario) => choose({ scenario })}
					>{#each options as item (item.scenario)}<option value={item.scenario}>{item.title}</option
						>{/each}</Select
				></label
			><label
				>State<Select
					label="State"
					bind:value={() => pick?.state ?? '', (state) => choose({ state })}
					>{#each option.states as id (id)}<option value={id}>{id}</option>{/each}</Select
				></label
			><SegmentedChoice
				label="Viewport"
				options={option.viewports.map((item) => item.id)}
				bind:value={() => pick?.viewport ?? '', (viewport) => choose({ viewport })}
			/><small>{size}</small>
		</div>{/if}
	<div class="runtime-panes" class:paired>
		{#each panes as item (item.id)}<RuntimePane {item} {evidence} {...heading(item)} />{/each}
	</div>
</div>
