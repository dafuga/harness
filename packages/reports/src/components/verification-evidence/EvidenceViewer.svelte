<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
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
	let after = $derived(pair.find((item) => item.phase === 'after') || selected);
	let displayed = $derived(view === 'before' && before ? before : after);
	let canNavigate = $derived(!!selected && navigableItems.some((item) => item.id !== selected?.id));
	let shown = $derived(
		view === 'compare' && before && after
			? [before, after]
			: view === 'before' && before
				? [before]
				: after
					? [after]
					: []
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
<Modal open={!!selected} title={displayed?.title || ''} variant="lightbox" onclose={close}>
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
	<!-- Stated before the image, so what produced it is read without scrolling past it. -->
	{#if displayed?.provenance}
		<hx-div class="viewer-provenance"><EvidenceProvenance item={displayed} /></hx-div>
	{/if}
	<hx-div class:comparison={view === 'compare'} class="viewer-images">
		<!-- Keyed by view too, so every image or view change mounts a fresh zoom state at fit. -->
		{#each shown as item (`${view}:${item.id}`)}<hx-figure>
				{#if item.missing}<hx-span class="missing">{item.note || $t('missing')}</hx-span>
				{:else}<ImageZoom src={assetBase + item.file} alt={item.title} />
					<hx-a class="text-link" href={assetBase + item.file} target="_blank" rel="noreferrer"
						>{$t('downloadImage')} ↗</hx-a
					>{/if}
				<hx-figcaption>
					{item.standing ?? $t(item.phase || 'current')} · {item.title}{#if item.viewport}
						{' · '}{item.viewport}{/if}
					{#if !item.missing && item.note}<hx-p class="viewer-note">{item.note}</hx-p>{/if}
				</hx-figcaption>
			</hx-figure>{/each}
	</hx-div>
</Modal>
{#if !selected}<hx-p class="muted">{$t('noScreenshotSelected')}</hx-p>{/if}

<style>
	/* Give recorded images the space left after the viewer's controls and provenance. */
	:global(.viewer-dialog.lightbox:has(.viewer-images) .viewer-content) {
		display: flex;
		flex-direction: column;
	}
	:global(.viewer-dialog.lightbox:has(.viewer-images) .viewer-content > :not(.viewer-images)) {
		flex: none;
	}
	:global(.viewer-dialog.lightbox .viewer-images) {
		flex: 1 1 0;
		min-height: 0;
	}
	:global(.viewer-dialog.lightbox .viewer-images.comparison) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	:global(.viewer-dialog.lightbox .viewer-images figure),
	:global(.viewer-dialog.lightbox .viewer-images .zoom) {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	:global(.viewer-dialog.lightbox .viewer-images .zoom),
	:global(.viewer-dialog.lightbox .viewer-images .stage) {
		flex: 1 1 0;
		min-height: 0;
	}
	:global(.viewer-dialog.lightbox .viewer-images .stage:not(.zoomed) img) {
		max-height: 100%;
		object-fit: contain;
	}
	.viewer-provenance {
		max-width: 80ch;
		margin: 0 auto var(--hx-space-12);
	}
	.viewer-note {
		max-width: 80ch;
		margin: var(--hx-space-14) auto;
		text-align: left;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: var(--hx-type-size-sm);
		line-height: var(--hx-style-leading-normal);
	}
</style>
