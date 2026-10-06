<script lang="ts">
	import type { Evidence } from '../models/Report.types';
	import { galleryEvidence, screenSize, type ScreenSize } from '../utils/reportFilter';
	import { t } from '../utils/reportLocale';
	import ImageZoom from './ImageZoom.svelte';
	import Modal from './Modal.svelte';
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
		if (!selected || !navigableItems.length) return;
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
	title={view === 'before' && before ? before.title : selected?.title || ''}
	variant="lightbox"
	onclose={close}
>
	<div class="viewer-actions toolbar">
		<button onclick={() => move(-1)} aria-label={$t('previous')}>←</button>
		<button onclick={() => move(1)} aria-label={$t('next')}>→</button>
		{#if before}
			<button
				class:active={view === 'before'}
				aria-label={$t('viewBeforeScreenshot')}
				onclick={() => (view = 'before')}>{$t('before')}</button
			>
			<button
				class:active={view === 'after'}
				aria-label={$t('viewAfterScreenshot')}
				onclick={() => (view = 'after')}>{$t('after')}</button
			>
			<button
				class:active={view === 'compare'}
				aria-label={$t('compare')}
				onclick={() => (view = 'compare')}>{$t('compare')}</button
			>
		{/if}
		<span class="muted">{$t('keyboard')}</span>
	</div>
	<div class="viewer-sizes toolbar" role="group" aria-label={$t('viewport')}>
		{#each ['mobile', 'tablet', 'desktop'] as size}
			<button
				class:active={selected && screenSize(selected) === size}
				aria-pressed={selected ? screenSize(selected) === size : false}
				aria-label={$t('view' + size.charAt(0).toUpperCase() + size.slice(1) + 'Screenshots')}
				disabled={!sizeCounts[size as 'mobile' | 'tablet' | 'desktop']}
				onclick={() => switchSize(size as ScreenSize)}>{$t(size + 'Screenshots')}</button
			>
		{/each}
	</div>
	<div class:comparison={view === 'compare'} class="viewer-images">
		<!-- Keyed by view too, so every image or view change mounts a fresh zoom state at fit. -->
		{#each shown as item (`${view}:${item.id}`)}<figure>
				{#if item.missing}<span class="missing">{item.note || $t('missing')}</span>
				{:else}<ImageZoom src={assetBase + item.file} alt={item.title} />
					<a class="text-link" href={assetBase + item.file} target="_blank" rel="noreferrer"
						>{$t('downloadImage')} ↗</a
					>{/if}
				<figcaption>
					{$t(item.phase || 'current')} · {item.title}{#if item.viewport}
						· {item.viewport}{/if}
					{#if !item.missing && item.note}<p class="viewer-note">{item.note}</p>{/if}
				</figcaption>
			</figure>{/each}
	</div>
</Modal>

<style>
	.viewer-note {
		max-width: 80ch;
		margin: 14px auto;
		text-align: left;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: 14px;
		line-height: 1.6;
	}
</style>
