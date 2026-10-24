<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerEvidence, ExplorerScope } from '../../models/explorer-ui/Explorer.types';
	import type { Evidence } from '../../models/reports-media/Report.types';
	import { entityLens, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import type { EntityReasons as Reasons } from '../../utils/explorer-ui/entityReasons';
	import {
		entityScreens,
		screenPick,
		type ScreenOption,
		type ScreenPick
	} from '../../utils/explorer-ui/entityScreens';
	import EvidenceViewer from '../verification-evidence/EvidenceViewer.svelte';
	import EntityReasons from './entity-reasons/EntityReasons.svelte';
	import HarnessAction from './HarnessAction.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
	let {
		options,
		evidence,
		scope,
		mediaBase,
		nav,
		reasons,
		preview
	}: {
		/** The visual scenarios of the entity with the states and viewports each declares. */
		options: ScreenOption[];
		evidence: ExplorerEvidence;
		scope: ExplorerScope;
		mediaBase: string;
		nav: EntityNav;
		/** What the commit says it changed in the entity: a summary, with what was written beside it. */
		reasons: Reasons;
		/** The scenario and state the entity declares as its preview; only the viewport is chosen. */
		preview?: ScreenPick;
	} = $props();
	/** The viewport a person pressed; scenario and state are never chosen here, but in States. */
	let wanted = $state<string>();
	let viewing = $state<Evidence | null>(null);
	let pick = $derived(picked(wanted));
	let option = $derived(options.find((item) => item.scenario === pick?.scenario));
	// An entity no visual scenario names still has its sides: each says that nothing is captured.
	let shown = $derived(entityScreens(evidence, pick));
	let paired = $derived(evidence.mode === 'commit');
	// Sides that were not recorded alike are shown, and are not called a comparison.
	let unlike = $derived(paired ? evidence.incomparable : []);
	let panes = $derived([...(shown.before ? [shown.before] : []), shown.after]);
	let size = $derived(option?.viewports.find((item) => item.id === pick?.viewport)?.size ?? '');
	const entity = () => ({ category: nav.route.category, entity: nav.route.entity });
	let tests = $derived(entityLens(nav.route, { ...entity(), tab: 'states' }));
	/** A declared preview keeps its own scenario and state, never another in its place. */
	function picked(viewport?: string): ScreenPick | null {
		if (options.some((item) => item.scenario === 'focused'))
			return screenPick(options, {
				scenario: 'focused',
				state: preview?.state,
				viewport: viewport ?? preview?.viewport
			});
		const fixed = preview;
		if (!fixed) return screenPick(options, { viewport });
		const declared = options.find((item) => item.scenario === fixed.scenario);
		const known = declared?.viewports.find((item) => item.id === viewport);
		return { ...fixed, viewport: known?.id ?? fixed.viewport };
	}
	/** A capture is named by the revision it was recorded from, including an inherited image. */
	function heading(item: Evidence): string {
		const revision = item.source ?? (item.phase === 'before' ? scope.parent : scope.commit) ?? '';
		const at = shortCommit(revision);
		if (item.phase === 'before') return `Before · ${at}`;
		return paired ? `After · ${at}` : at;
	}
</script>

<hx-section
	class="ex-card ex-evidence"
	aria-labelledby="ex-screens-title"
	data-harness-component="harness-entity-screens"
>
	<hx-header class="ex-evidence-head">
		<hx-div>
			<hx-h2 id="ex-screens-title">
				{#if !paired}Current screenshot{:else if unlike.length}Before and after, not alike
				{:else}Commit comparison{/if}
			</hx-h2>
		</hx-div>
		{#if pick && option}
			<hx-div class="ex-segments" role="group" aria-label="Viewport">
				{#each option.viewports as item (item.id)}
					<hx-button
						type="button"
						aria-pressed={item.id === pick.viewport}
						title={item.size}
						onclick={() => (wanted = item.id)}>{item.label}</hx-button
					>
				{/each}
			</hx-div>
			{#if size}<hx-span class="ex-soft">{size}</hx-span>{/if}
		{/if}
		{#if paired}
			<HarnessAction href={nav.href(tests)} onclick={() => nav.go(tests)} icon="arrow-right"
				>View full comparison</HarnessAction
			>
		{/if}
	</hx-header>
	{#if unlike.length}
		<hx-div class="ex-gap">
			<HarnessVerdict passed={false} label="Not comparable" reasons={unlike} />
			<hx-ul class="ex-reasons" aria-label="Why the two sides are not compared">
				{#each unlike as reason}<hx-li>{reason}</hx-li>{/each}
			</hx-ul>
		</hx-div>
	{/if}
	<hx-div class="ex-panes" class:paired>
		{#each panes as item (item.id)}
			{@const named = heading(item)}
			<hx-figure class="ex-pane" aria-label={named}>
				<hx-figcaption>
					<hx-strong>{named}</hx-strong>
				</hx-figcaption>
				{#if item.missing}
					<hx-p class="ex-gap">
						<HarnessVerdict passed={false} label="No capture" />
						<hx-span>{item.note}</hx-span>
					</hx-p>
				{:else}
					<hx-button type="button" class="ex-shot" onclick={() => (viewing = item)}>
						<hx-img src={mediaBase + item.file} alt={`${item.title} at ${item.viewport}`} />
					</hx-button>
				{/if}
			</hx-figure>
		{/each}
	</hx-div>
	{#if paired}
		<hx-div class="ex-change">
			<HarnessIcon name="change" size={22} />
			<hx-strong>Behavior change</hx-strong>
			<hx-span
				>{reasons.behavior.text ||
					'This commit records no reason for a change of this entity.'}</hx-span
			>
			<EntityReasons {reasons} />
		</hx-div>
	{/if}
</hx-section>
<EvidenceViewer
	items={panes}
	navigableItems={panes.filter((item) => !item.missing)}
	selected={viewing}
	assetBase={mediaBase}
	onclose={() => (viewing = null)}
	onselect={(item) => (viewing = item)}
/>
