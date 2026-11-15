<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_6yyo3qlu7t -->
<script lang="ts">
	import Notice from './explorer-kit/Notice.svelte';
	import ComparePanes from '../shared-primitives/ComparePanes.svelte';
	import { comparisonPanes } from '../../helpers/verification-evidence/comparisonPanes';

	import type { ExplorerEvidence, ExplorerScope } from '../../models/explorer-ui/Explorer.types';
	import type { Evidence } from '../../models/reports-media/Report.types';
	import { entityScreens, galleryItems } from '../../utils/explorer-ui/entityScreens';
	import VideoEvidence from '../verification-evidence/VideoEvidence.svelte';
	import VideoGraphNavigation from '../verification-evidence/VideoGraphNavigation.svelte';
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
	let path = $state('');
	let viewing = $state<Evidence | null>(null);
	let resolved = $state<Record<string, { file: string; note?: string }>>({});
	const words = (id: string) =>
		id.replace(/[-_]/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
	let scenarios = $derived(evidence.scenarios.filter((scenario) => scenario.viewports.length > 0));
	let scenario = $derived(scenarios.find((item) => item.id === wanted) ?? scenarios[0]);
	let playlist = $derived(scenario?.video?.playlists.find((item) => item.id === path));
	let graphCoverage = $derived(evidence.after.record?.scenarios.find((item) => item.id === scenario?.id)?.videoCoverage ?? []);
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
	let videos = $derived(galleryItems(evidence).filter((item) => item.mediaType === 'video'));
	let assetBase = $derived(resolveImage ? '' : mediaBase);
	function prepared(item: Evidence): Evidence {
		if (!resolveImage || item.missing) return item;
		const read = resolved[item.id];
		return {
			...item,
			file: read?.file ?? '',
			missing: !read?.file,
			note: read ? (read.note ?? item.note) : 'Loading recorded capture…'
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
	const statePanes = (items: Evidence[]) =>
		comparisonPanes(
			{ value: items.find((item) => item.phase === 'before'), commit: scope.parent },
			{ value: items.find((item) => item.phase !== 'before'), commit: scope.commit },
			evidence.mode === 'commit'
		);
</script>

<hx-section class="states-gallery" aria-label={`${name} supported states`}>
	<hx-header>
		<hx-div>
			<hx-h2>States</hx-h2>
			<hx-p>Recorded screenshots and videos of each supported state.</hx-p>
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
	{#if scenario?.video}<VideoGraphNavigation library={scenario.video} coverage={graphCoverage} bind:selected={path} />{/if}
	{#if evidence.incomparable.length}<Notice as="p" className={'state-gap entity-states-state-gap'}
			>{evidence.incomparable.join(' ')}</Notice
		>{/if}
	{#if !rows.length}<Notice as="p" className={'state-gap entity-states-state-gap'}>
			No visual states are declared for this entity at this revision.
		</Notice>{/if}
	<hx-div class="state-grid" class:paired={evidence.mode === 'commit'}>
		{#each rows as row (`${scenario.id}-${row.state.id}-${screen?.id}`)}
			<hx-article class="state-card" aria-label={row.title}>
				<hx-div class="state-heading">
					<hx-h3>{row.title}</hx-h3>
					<hx-small>{screen?.width} × {screen?.height}</hx-small>
				</hx-div>
				{#if row.state.coverage !== 'required'}<Notice
						as="p"
						className={'state-gap entity-states-state-gap'}
					>
						{words(row.state.coverage)}: {row.state.reason ??
							'This state has no declared capture coverage.'}
					</Notice>{/if}
				{#if row.state.coverage !== 'inapplicable'}<ComparePanes
						panes={statePanes(row.items)}
						className="state-panes"
						framed={false}
					>
						{#snippet children(pane)}
							{#if pane.value}
								{@const item = pane.value}
								{@const shown = prepared(item)}
								<hx-figure>
									<hx-figcaption>{pane.heading}</hx-figcaption>
									{#if shown.missing}<Notice as="p" className={'state-gap entity-states-state-gap'}>
											{shown.note ?? 'No screenshot was recorded.'}
										</Notice>
									{:else}<EvidenceCard
											compact
											item={shown}
											{assetBase}
											onopen={() => (viewing = shown)}
										/>{/if}
								</hx-figure>
							{/if}
						{/snippet}
					</ComparePanes>{/if}
				{#each videos.filter((clip) => clip.category === scenario.id && clip.state === row.state.id && clip.viewport === screen?.id && (!playlist || playlist.clips.includes(clip.video?.clipId ?? ''))) as clip (clip.id)}
					<VideoEvidence item={clip} assetBase={mediaBase} />
				{/each}
			</hx-article>
		{/each}
	</hx-div>
</hx-section>
{#if viewing}<EvidenceViewer
		items={items.map(prepared)}
		navigableItems={items.map(prepared).filter((item) => !item.missing)}
		selected={viewing}
		{assetBase}
		onclose={() => (viewing = null)}
		onselect={(item) => (viewing = item)}
	/>{/if}
