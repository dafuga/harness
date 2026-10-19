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
	import Select from '../Select.svelte';
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
		reasons
	}: {
		/** The visual scenarios of the entity with the states and viewports each declares. */
		options: ScreenOption[];
		evidence: ExplorerEvidence;
		scope: ExplorerScope;
		mediaBase: string;
		nav: EntityNav;
		/** What the commit says it changed in the entity: a summary, with what was written beside it. */
		reasons: Reasons;
	} = $props();
	let wanted = $state<Partial<ScreenPick>>({});
	let viewing = $state<Evidence | null>(null);
	let pick = $derived(screenPick(options, wanted));
	let option = $derived(options.find((item) => item.scenario === pick?.scenario));
	// An entity no visual scenario names still has its sides: each says that nothing is captured.
	let shown = $derived(entityScreens(evidence, pick));
	let paired = $derived(evidence.mode === 'commit');
	// Sides that were not recorded alike are shown, and are not called a comparison.
	let unlike = $derived(paired ? evidence.incomparable : []);
	let panes = $derived([...(shown.before ? [shown.before] : []), shown.after]);
	let size = $derived(option?.viewports.find((item) => item.id === pick?.viewport)?.size ?? '');
	const choose = (changed: Partial<ScreenPick>) => (wanted = { ...pick, ...changed });
	const entity = () => ({ category: nav.route.category, entity: nav.route.entity });
	let tests = $derived(entityLens(nav.route, { ...entity(), tab: 'states' }));
	let commit = $derived(entityLens(nav.route, { ...entity(), commit: scope.commit }));
	/** Who a pane is: the parent, the selected commit, or the one snapshot of the branch tip. */
	function heading(item: Evidence): { title: string; role: string } {
		if (item.phase === 'before') {
			return { title: `Before · ${shortCommit(scope.parent ?? '')}`, role: 'Parent commit' };
		}
		const at = shortCommit(scope.commit);
		if (paired) return { title: `After · ${at}`, role: 'Selected commit' };
		const origin = shown.origin ? `Inherited from ${shortCommit(shown.origin)}` : 'Branch tip';
		return { title: `Current snapshot · ${at}`, role: origin };
	}
</script>

<section class="ex-card ex-evidence" aria-labelledby="ex-screens-title">
	<header class="ex-evidence-head">
		<div>
			<h2 id="ex-screens-title">
				{#if !paired}Current screenshot{:else if unlike.length}Before and after, not alike
				{:else}Commit comparison{/if}
			</h2>
			<p class="ex-soft">
				{#if !paired}One screenshot of this entity at the current branch tip.
				{:else if unlike.length}The two sides were not recorded alike, so they are not compared.
				{:else}The same scenario, state and viewport before and after the selected commit.{/if}
			</p>
		</div>
		{#if paired}
			<HarnessAction href={nav.href(tests)} onclick={() => nav.go(tests)} icon="arrow-right"
				>View full comparison</HarnessAction
			>
		{:else}
			<HarnessAction
				href={nav.href(commit)}
				onclick={() => nav.go(commit)}
				tone="plain"
				icon="arrow-right">View commit changes</HarnessAction
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
	{#if pick && option}
		<div class="ex-facts" role="group" aria-label="What is shown">
			<label
				>Scenario
				<Select
					label="Scenario"
					disabled={options.length < 2}
					bind:value={() => pick?.scenario ?? '', (scenario) => choose({ scenario })}
				>
					{#each options as item, position (position)}
						<option value={item.scenario}>{item.title}</option>
					{/each}
				</Select>
			</label>
			<label
				>State
				<Select label="State" bind:value={() => pick?.state ?? '', (state) => choose({ state })}>
					{#each option.states as id (id)}<option value={id}>{id}</option>{/each}
				</Select>
			</label>
			<div class="ex-segments" role="group" aria-label="Viewport">
				{#each option.viewports as item (item.id)}
					<button
						type="button"
						aria-pressed={item.id === pick.viewport}
						title={item.size}
						onclick={() => choose({ viewport: item.id })}>{item.label}</button
					>
				{/each}
			</div>
			<span class="ex-soft">{size}</span>
		</div>
	{/if}
	<div class="ex-panes" class:paired>
		{#each panes as item (item.id)}
			<figure class="ex-pane" aria-label={heading(item).title}>
				<figcaption>
					<strong>{heading(item).title}</strong>
					<span class="ex-pill">{heading(item).role}</span>
					{#if !item.missing}
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
					<p class="ex-standing" class:stale={item.standing !== 'Fresh capture'}>
						{item.standing} · {item.status}
					</p>
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
