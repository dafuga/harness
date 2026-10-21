<script lang="ts">
	import type { ExplorerEvidence, ExplorerScope } from '../../models/Explorer.types';
	import type { Evidence } from '../../models/Report.types';
	import { entityLens, shortCommit, type EntityNav } from '../../utils/entityLens';
	import type { EntityReasons as Reasons } from '../../utils/entityReasons';
	import {
		entityScreens,
		screenPick,
		type ScreenOption,
		type ScreenPick
	} from '../../utils/entityScreens';
	import EvidenceViewer from '../EvidenceViewer.svelte';
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
	/** Who a pane is: the parent, the selected commit, or the branch tip the section names. */
	function heading(item: Evidence): { title: string; role?: string } {
		if (item.phase === 'before') {
			return { title: `Before · ${shortCommit(scope.parent ?? '')}`, role: 'Parent commit' };
		}
		const at = shortCommit(scope.commit);
		if (paired) return { title: `After · ${at}`, role: 'Selected commit' };
		return { title: `Branch tip · ${at}` };
	}
	/** Where a shown capture was taken and how its check ended; a reused one names its commit. */
	function standing(item: Evidence): string {
		if (item.standing === 'Focused capture') return item.standing;
		const reused = item.phase !== 'before' && shown.origin;
		const origin = reused ? `Inherited from ${shortCommit(reused)}` : item.standing;
		return [origin, item.status].filter(Boolean).join(' · ');
	}
</script>

<section class="ex-card ex-evidence" aria-labelledby="ex-screens-title">
	<header class="ex-evidence-head">
		<div>
			<h2 id="ex-screens-title">
				{#if !paired}Current screenshot{:else if unlike.length}Before and after, not alike
				{:else}Commit comparison{/if}
			</h2>
		</div>
		{#if pick && option}
			<div class="ex-segments" role="group" aria-label="Viewport">
				{#each option.viewports as item (item.id)}
					<button
						type="button"
						aria-pressed={item.id === pick.viewport}
						title={item.size}
						onclick={() => (wanted = item.id)}>{item.label}</button
					>
				{/each}
			</div>
			{#if size}<span class="ex-soft">{size}</span>{/if}
		{/if}
		{#if paired}
			<HarnessAction href={nav.href(tests)} onclick={() => nav.go(tests)} icon="arrow-right"
				>View full comparison</HarnessAction
			>
		{/if}
	</header>
	{#if unlike.length}
		<div class="ex-gap">
			<HarnessVerdict passed={false} label="Not comparable" reasons={unlike} />
			<ul class="ex-reasons" aria-label="Why the two sides are not compared">
				{#each unlike as reason}<li>{reason}</li>{/each}
			</ul>
		</div>
	{/if}
	<div class="ex-panes" class:paired>
		{#each panes as item (item.id)}
			{@const named = heading(item)}
			<figure class="ex-pane" aria-label={named.title}>
				<figcaption>
					<strong>{named.title}</strong>
					{#if named.role}<span class="ex-pill">{named.role}</span>{/if}
					{#if !item.missing}
						<span
							class="ex-standing"
							class:stale={item.standing !== 'Fresh capture' && item.standing !== 'Focused capture'}
							>{standing(item)}</span
						>
						<button type="button" class="ex-text-button" onclick={() => (viewing = item)}
							><HarnessIcon name="expand" size={16} /> Open full size</button
						>
					{/if}
				</figcaption>
				{#if item.missing}
					<p class="ex-gap">
						<HarnessVerdict passed={false} label="No capture" />
						<span>{item.note}</span>
					</p>
				{:else}
					<button type="button" class="ex-shot" onclick={() => (viewing = item)}>
						<img src={mediaBase + item.file} alt={`${item.title} at ${item.viewport}`} />
					</button>
				{/if}
			</figure>
		{/each}
	</div>
	{#if paired}
		<div class="ex-change">
			<HarnessIcon name="change" size={22} />
			<strong>Behavior change</strong>
			<span
				>{reasons.behavior.text ||
					'This commit records no reason for a change of this entity.'}</span
			>
			<EntityReasons {reasons} />
		</div>
	{/if}
</section>
<EvidenceViewer
	items={panes}
	navigableItems={panes.filter((item) => !item.missing)}
	selected={viewing}
	assetBase={mediaBase}
	onclose={() => (viewing = null)}
	onselect={(item) => (viewing = item)}
/>
