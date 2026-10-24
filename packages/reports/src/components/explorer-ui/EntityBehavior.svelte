<script lang="ts">
	import { untrack } from 'svelte';
	import type { ExplorerBehavior, ExplorerScope } from '../../models/explorer-ui/Explorer.types';
	import { entityBehavior } from '../../utils/explorer-ui/entityBehavior';
	import { entityLens, type EntityNav } from '../../utils/explorer-ui/entityLens';
	import { shortCommit } from '../../helpers/strings/shortCommit';
	import { notMeasured } from '../../utils/explorer-ui/entityMeasure';
	import type { EntityReasons as Reasons } from '../../utils/explorer-ui/entityReasons';
	import { explorerReading } from '../../utils/explorer-ui/explorer-reading/explorerReading';
	import EntityReasons from './entity-reasons/EntityReasons.svelte';
	import EntityRun from './EntityRun.svelte';
	import HarnessAction from './HarnessAction.svelte';
	import HarnessIcon from './HarnessIcon.svelte';
	import HarnessVerdict from './harness-verdict/HarnessVerdict.svelte';
	let {
		behavior,
		read = null,
		scope,
		mediaBase,
		nav,
		reasons,
		duration = notMeasured,
		unit
	}: {
		/** The recorded results of both sides as the host found them, before any is read. */
		behavior: ExplorerBehavior;
		/** The same with every result read and compared, when a caller already has it. */
		read?: ExplorerBehavior | null;
		scope: ExplorerScope;
		mediaBase: string;
		nav: EntityNav;
		/** What the commit says it changed in the entity, where the entity is read; not in its tests. */
		reasons?: Reasons;
		/** How long the end-to-end checks of the shown revision ran, when its record says. */
		duration?: string;
		/** The function the results are shown for, when they are shown as its rows. */
		unit?: string;
	} = $props();
	// A reading belongs to the recorded results it read, whichever object lists them.
	const sign = (of: ExplorerBehavior) =>
		of.rows.map((row) => `${row.before?.sha256}>${row.after?.sha256}`).join('|');
	// Held as it was read: what a result holds is shown, never changed, and is compared by name.
	let loaded = $state.raw<{ of: string; read: ExplorerBehavior | null } | null>(null);
	// Every recorded result is read when the entity is opened, so what it did is seen at once.
	$effect(() => {
		const of = sign(behavior);
		if (read || behavior.rows.length === 0 || untrack(() => loaded?.of) === of) return;
		// A reading that ends after another set of results is shown belongs to nothing shown.
		const keep = (found: ExplorerBehavior | null) => {
			if (sign(behavior) === of) loaded = { of, read: found };
		};
		void explorerReading(behavior, mediaBase).then(keep, () => keep(null));
	});
	// Undefined while nothing was read for these results; null when reading them failed.
	let known = $derived.by(() => {
		if (read) return read;
		return loaded && loaded.of === sign(behavior) ? loaded.read : undefined;
	});
	let reading = $derived(known === undefined && behavior.rows.length > 0);
	let shown = $derived(entityBehavior(known ?? behavior));
	// A first commit is shown as one run: it has no parent to stand beside.
	let paired = $derived(shown.mode === 'commit' && scope.parent !== null);
	const entity = () => ({ category: nav.route.category, entity: nav.route.entity });
	let tests = $derived(entityLens(nav.route, { ...entity(), tab: 'tests' }));
	let commit = $derived(entityLens(nav.route, { ...entity(), commit: scope.commit }));
	let at = $derived(shortCommit(scope.commit));
	// What the host concluded without reading stands at once: one run, or unknown with its reason.
	let fixed = $derived(
		behavior.summary === 'not-compared' ||
			(behavior.summary === 'unknown' && behavior.reason !== null)
	);
	// Nothing else is called unchanged or changed before it was read.
	let pending = $derived(reading && !fixed);
	let label = $derived.by(() => {
		if (pending) return 'Reading the recorded results…';
		return known === null ? 'Behavior unknown' : shown.label;
	});
	let unknown = $derived(!pending && (known === null || shown.unknown));
	let settled = $derived(
		['Behavior unchanged', 'Current behavior'].includes(label) && shown.passed
	);
	let why = $derived(
		known === null ? 'The recorded results could not be read.' : shown.reasons.join('; ')
	);
</script>

<section
	class="ex-card ex-evidence"
	aria-labelledby="ex-behavior-title"
	data-harness-component="harness-entity-behavior"
>
	<header class="ex-evidence-head">
		<div>
			<h2 id="ex-behavior-title">
				{paired ? 'End-to-end test comparison' : 'Current end-to-end behavior'}
			</h2>
			<p class="ex-soft">
				{paired
					? 'The same scenario and the same states on both revisions.'
					: `What the end-to-end checks recorded at ${at}.`}
			</p>
		</div>
		<HarnessAction href={nav.href(tests)} onclick={() => nav.go(tests)} icon="arrow-right"
			>{unit ? 'View examples' : paired ? 'View full comparison' : 'View full test'}</HarnessAction
		>
		{#if scope.mode === 'current'}
			<HarnessAction
				href={nav.href(commit)}
				onclick={() => nav.go(commit)}
				tone="plain"
				icon="arrow-right">View commit changes</HarnessAction
			>
		{/if}
	</header>
	{#if shown.groups.length === 0}
		<p class="ex-gap ex-unrecorded">
			<HarnessVerdict passed={false} label="Evidence missing" />
			<span>No end-to-end result is recorded for this entity at {at}.</span>
		</p>
	{:else}
		<div class="ex-panes" class:paired>
			{#if paired}
				<EntityRun
					{shown}
					side="before"
					title={`Before · ${shortCommit(scope.parent ?? '')}`}
					role="Parent commit"
					{mediaBase}
					lost={known === null}
					{unit}
				/>
			{/if}
			<EntityRun
				{shown}
				side="after"
				title={paired ? `After · ${at}` : `Current snapshot · ${at}`}
				role={paired ? 'Selected commit' : 'Branch tip'}
				{mediaBase}
				lost={known === null}
				{unit}
			/>
		</div>
	{/if}
	<div class="ex-change">
		{#if pending}
			<HarnessIcon name="clock" size={22} />
		{:else if unknown}
			<HarnessVerdict passed={false} {label} reasons={why ? [why] : []} />
		{:else if settled}
			<HarnessVerdict passed={true} {label} />
		{:else}
			<HarnessIcon name="change" size={22} />
		{/if}
		<strong role="status">{label}</strong>
		<span>{reasons?.behavior.text || why || 'No reason is recorded for this entity here.'}</span>
		{#if reasons}<EntityReasons {reasons} />{/if}
		<dl class="ex-inline">
			<div>
				<dt>E2E duration</dt>
				<dd class:unmeasured={duration === notMeasured}>{duration}</dd>
			</div>
			{#each shown.scenarios as scenario (scenario.id)}
				<div>
					<dt>{scenario.title}</dt>
					<dd class:failed={scenario.after !== 'passed'}>
						{paired ? `${scenario.before ?? 'not run'} → ` : ''}{scenario.after ?? 'not run'}
					</dd>
				</div>
			{/each}
		</dl>
	</div>
</section>

<style>
	.ex-gap.ex-unrecorded {
		border-color: var(--hx-color-border);
		color: var(--hx-color-text-muted);
	}
</style>
