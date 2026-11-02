<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import ComparePanes from '../shared-primitives/ComparePanes.svelte';
	import EmptyState from '../explorer-ui/explorer-kit/EmptyState.svelte';
	import { comparisonPanes } from '../../helpers/verification-evidence/comparisonPanes';
	import type { Evidence } from '../../models/reports-media/Report.types';
	import {
		galleryEvidence,
		screenSize,
		type ScreenSize
	} from '../../utils/verification-evidence/reportFilter';
	import { t } from '../../utils/reports-media/reportLocale';
	import EvidenceProvenance from './EvidenceProvenance.svelte';
	import ImageZoom from '../shared-primitives/image-zoom/ImageZoom.svelte';
	import Modal from '../shared-primitives/Modal.svelte';
	let {
		items,
		navigableItems,
		selected,
		assetBase,
		onclose,
		onselect
	}: {
		items: Evidence[];
		navigableItems: Evidence[];
		selected: Evidence | null;
		assetBase: string;
		onclose: () => void;
		onselect: (item: Evidence, updateViewport?: boolean) => void;
	} = $props();
	let view = $state<'after' | 'before' | 'compare'>('after');
	let browsable = $derived(galleryEvidence(items));
	let sizeCounts = $derived({
		mobile: browsable.filter((item) => screenSize(item) === 'mobile').length,
		tablet: browsable.filter((item) => screenSize(item) === 'tablet').length,
		desktop: browsable.filter((item) => screenSize(item) === 'desktop').length
	});
	let pair = $derived(
		items.filter(
			(item) =>
				selected?.comparison &&
				item.comparison === selected.comparison &&
				item.viewport === selected.viewport &&
				['before', 'after'].includes(item.phase || '')
		)
	);
	let before = $derived(pair.find((item) => item.phase === 'before'));
	let after = $derived(
		pair.find((item) => item.phase === 'after') ??
			(selected?.phase === 'before' ? undefined : (selected ?? undefined))
	);
	let displayed = $derived(view === 'before' && before ? before : after);
	let canNavigate = $derived(!!selected && navigableItems.some((item) => item.id !== selected?.id));
	const panes = $derived(
		comparisonPanes(
			{
				value: before,
				commit: before?.source,
				key: `${view}:before:${before?.id ?? 'missing'}`,
				gap: 'No before screenshot is recorded for this state.'
			},
			{
				value: after,
				commit: after?.source,
				key: `${view}:after:${after?.id ?? 'missing'}`,
				gap: 'No after screenshot is recorded for this state.'
			},
			Boolean(selected?.comparison && selected.phase !== 'current')
		)
	);

	function switchSize(size: ScreenSize) {
		const candidates = browsable.filter((item) => screenSize(item) === size);
		const match =
			candidates.find((item) => selected?.comparison && item.comparison === selected.comparison) ||
			candidates.find(
				(item) => item.category === selected?.category && item.title === selected?.title
			) ||
			candidates.find((item) => item.category === selected?.category) ||
			candidates[0];
		if (!match || match.id === selected?.id) return;
		const hasBefore = items.some(
			(item) =>
				item.comparison &&
				item.comparison === match.comparison &&
				item.viewport === match.viewport &&
				item.phase === 'before'
		);
		if (!hasBefore) view = 'after';
		onselect(match, true);
	}
	function move(offset: number) {
		if (!selected || !canNavigate) return;
		const index = navigableItems.findIndex((item) => item.id === selected.id);
		onselect(navigableItems[(index + offset + navigableItems.length) % navigableItems.length]);
		view = 'after';
	}
	function keyboard(event: KeyboardEvent) {
		if (!selected) return;
		if (event.key === 'ArrowRight') move(1);
		if (event.key === 'ArrowLeft') move(-1);
	}
	function close() {
		view = 'after';
		onclose();
	}
</script>

<svelte:window onkeydown={keyboard} />
<Modal
	open={!!selected}
	title={displayed?.title || selected?.title || ''}
	variant="lightbox"
	onclose={close}
>
	<hx-div class="viewer-actions toolbar">
		<hx-button disabled={!canNavigate} onclick={() => move(-1)} aria-label={$t('previous')}
			>←</hx-button
		>
		<hx-button disabled={!canNavigate} onclick={() => move(1)} aria-label={$t('next')}>→</hx-button>
		{#if before}
			<hx-button
				class:active={view === 'before'}
				aria-label={$t('viewBeforeScreenshot')}
				onclick={() => (view = 'before')}>{$t('before')}</hx-button
			>
			<hx-button
				class:active={view === 'after'}
				aria-label={$t('viewAfterScreenshot')}
				onclick={() => (view = 'after')}>{$t('after')}</hx-button
			>
			<hx-button
				class:active={view === 'compare'}
				aria-label={$t('compare')}
				onclick={() => (view = 'compare')}>{$t('compare')}</hx-button
			>
		{/if}
		{#if canNavigate}<hx-span class="muted">{$t('keyboard')}</hx-span>{/if}
	</hx-div>
	<hx-div class="viewer-sizes toolbar" role="group" aria-label={$t('viewport')}>
		{#each ['mobile', 'tablet', 'desktop'] as size}
			<hx-button
				class:active={selected && screenSize(selected) === size}
				aria-pressed={selected ? screenSize(selected) === size : false}
				aria-label={$t('view' + size.charAt(0).toUpperCase() + size.slice(1) + 'Screenshots')}
				disabled={!sizeCounts[size as 'mobile' | 'tablet' | 'desktop']}
				onclick={() => switchSize(size as ScreenSize)}>{$t(size + 'Screenshots')}</hx-button
			>
		{/each}
	</hx-div>

	<hx-div class:comparison={view === 'compare'} class="viewer-images">
		<!-- Keyed by view too: a new view mounts a fresh image zoom state at fit. -->
		<ComparePanes {panes} visible={view === 'compare' ? 'both' : view} framed={false} contents>
			{#snippet children(pane)}
				{@const item = pane.value}
				<hx-figure>
					{#if item?.provenance}<hx-div class="viewer-provenance"
							><EvidenceProvenance {item} /></hx-div
						>{/if}
					{#if !item}<EmptyState className="missing">{pane.gap}</EmptyState>
					{:else if item.missing}<hx-span class="missing">{item.note || $t('missing')}</hx-span>
					{:else}<ImageZoom src={assetBase + item.file} alt={item.title} />
						<hx-a class="text-link" href={assetBase + item.file} target="_blank" rel="noreferrer"
							>{$t('downloadImage')} ↗</hx-a
						>
					{/if}
					<hx-figcaption>
						{pane.heading}{#if item}
							{' · '}{item.title}{#if item.viewport}
								{' · '}{item.viewport}{/if}
							{#if item.standing}<hx-span> · {item.standing}</hx-span>{/if}
							{#if !item.missing && item.note}<hx-p class="viewer-note">{item.note}</hx-p>{/if}
						{/if}
					</hx-figcaption>
				</hx-figure>
			{/snippet}
		</ComparePanes>
	</hx-div>
</Modal>
{#if !selected}<hx-p class="muted">{$t('noScreenshotSelected')}</hx-p>{/if}

<style>
	@import './evidenceViewer.css';
</style>
