<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { ExplorerEvidence, ExplorerScope } from '../../models/explorer-ui/Explorer.types';
	import type { Evidence } from '../../models/reports-media/Report.types';
	import { entityScreens } from '../../utils/explorer-ui/entityScreens';
	import EvidenceCard from '../verification-evidence/EvidenceCard.svelte';
	import EvidenceViewer from '../verification-evidence/EvidenceViewer.svelte';
	import Select from '../shared-primitives/Select.svelte';
	import '../../lib/styles/entity-states.css';
	let {
		name,
		evidence,
		scope,
		mediaBase = '',
		resolveImage
	}: {
		name: string;
		evidence: ExplorerEvidence;
		scope: ExplorerScope;
		mediaBase?: string;
		/** Native and hosted bridges resolve only hash-checked artifact bytes. */
		resolveImage?: (item: Evidence) => Promise<string>;
	} = $props();
	let wanted = $state('');
	let viewport = $state('');
	let viewing = $state<Evidence | null>(null);
	let resolved = $state<Record<string, { file: string; note?: string }>>({});
	const words = (id: string) =>
		id.replace(/[-_]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
	let scenarios = $derived(evidence.scenarios.filter((scenario) => scenario.viewports.length > 0));
	let scenario = $derived(scenarios.find((item) => item.id === wanted) ?? scenarios[0]);
	let screen = $derived(
		scenario?.viewports.find((item) => item.id === viewport) ?? scenario?.viewports[0]
	);
	let rows = $derived(
		(scenario?.states ?? []).map((state) => {
			const shown = entityScreens(evidence, {
				scenario: scenario.id,
				state: state.id,
				viewport: screen?.id ?? ''
			});
			const title = state.title ?? words(state.id);
			return {
				state,
				title,
				items: [...(shown.before ? [shown.before] : []), shown.after].map((item) => ({
					...item,
					title: `${title} · ${phase(item)}`
				}))
			};
		})
	);
	let items = $derived(rows.flatMap((row) => row.items));
	let assetBase = $derived(resolveImage ? '' : mediaBase);
	function prepared(item: Evidence): Evidence {
		if (!resolveImage || item.missing) return item;
		const read = resolved[item.id];
		return {
			...item,
			file: read?.file ?? '',
			missing: !read?.file,
			note: read?.note ?? item.note ?? 'Loading recorded capture…'
		};
	}
	$effect(() => {
		const read = resolveImage;
		const captures = items.filter((item) => !item.missing);
		if (!read) return;
		let active = true;
		resolved = {};
		viewing = null;
		void Promise.all(
			captures.map(async (item) => {
				try {
					return [item.id, { file: await read(item) }] as const;
				} catch (error) {
					return [
						item.id,
						{
							file: '',
							note: error instanceof Error ? error.message : 'Capture could not be loaded.'
						}
					] as const;
				}
			})
		).then((entries) => {
			if (active) resolved = Object.fromEntries(entries);
		});
		return () => {
			active = false;
		};
	});
	function phase(item: Evidence): string {
		if (item.phase === 'before') return 'Before';
		return evidence.mode === 'commit' ? 'After' : 'Current';
	}
	const revision = (item: Evidence) =>
		(item.phase === 'before' ? scope.parent : scope.commit)?.slice(0, 7) ?? '';
</script>

<hx-section class="states-gallery" aria-label={`${name} supported states`}>
	<hx-header>
		<hx-div>
			<hx-h2>States</hx-h2>
			<hx-p>Recorded screenshots of each supported state.</hx-p>
		</hx-div>
		<hx-div class="state-controls">
			{#if scenarios.length > 1}
				<hx-label
					>Scenario<Select
						label="Scenario"
						bind:value={() => scenario?.id ?? '', (value) => (wanted = value)}
					>
						{#each scenarios as option (option.id)}<hx-option value={option.id}
								>{option.title}</hx-option
							>{/each}
					</Select></hx-label
				>
			{/if}
			{#if screen}
				<hx-label
					>Viewport<Select
						label="Viewport"
						bind:value={() => screen?.id ?? '', (value) => (viewport = value)}
					>
						{#each scenario.viewports as option (option.id)}<hx-option value={option.id}
								>{words(option.id)} · {option.width} × {option.height}</hx-option
							>{/each}
					</Select></hx-label
				>
			{/if}
		</hx-div>
	</hx-header>
	{#if evidence.incomparable.length}<hx-p class="state-gap">{evidence.incomparable.join(' ')}</hx-p
		>{/if}
	{#if !rows.length}<hx-p class="state-gap">
			No visual states are declared for this entity at this revision.
		</hx-p>{/if}
	<hx-div class="state-grid" class:paired={evidence.mode === 'commit'}>
		{#each rows as row (`${scenario.id}-${row.state.id}-${screen?.id}`)}
			<hx-article class="state-card" aria-label={row.title}>
				<hx-div class="state-heading">
					<hx-h3>{row.title}</hx-h3>
					<hx-small>{screen?.width} × {screen?.height}</hx-small>
				</hx-div>
				{#if row.state.coverage !== 'required'}<hx-p class="state-gap">
						{words(row.state.coverage)}: {row.state.reason ??
							'This state has no declared capture coverage.'}
					</hx-p>{/if}
				{#if row.state.coverage !== 'inapplicable'}<hx-div class="state-panes">
						{#each row.items as item (item.id)}
							{@const shown = prepared(item)}
							<hx-figure>
								<hx-figcaption>{phase(item)} <hx-code>{revision(item)}</hx-code></hx-figcaption>
								{#if shown.missing}<hx-p class="state-gap">
										{shown.note ?? 'No screenshot was recorded.'}
									</hx-p>
								{:else}<EvidenceCard
										compact
										item={shown}
										{assetBase}
										onopen={() => (viewing = shown)}
									/>{/if}
							</hx-figure>
						{/each}
					</hx-div>{/if}
			</hx-article>
		{/each}
	</hx-div>
</hx-section>
<EvidenceViewer
	items={items.map(prepared)}
	navigableItems={items.map(prepared).filter((item) => !item.missing)}
	selected={viewing}
	{assetBase}
	onclose={() => (viewing = null)}
	onselect={(item) => (viewing = item)}
/>
