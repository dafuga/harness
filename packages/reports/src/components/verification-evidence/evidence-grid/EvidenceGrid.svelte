<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ubshldh7p3 -->
<script lang="ts">
	import EmptyState from '../../explorer-ui/explorer-kit/EmptyState.svelte';
	import type { Media } from './EvidenceGrid.types';
	import type { Evidence } from '../../../models/reports-media/Report.types';
	import { evidenceMedia } from '../../../utils/verification-evidence/evidenceMedia';
	import { audioPairs } from '../../../utils/reports-media/audioPairs';
	import { t } from '../../../utils/reports-media/reportLocale';
	import {
		galleryEvidence,
		screenSize,
		type ScreenSize
	} from '../../../utils/verification-evidence/reportFilter';
	import { reportFilter } from './reportFilter';
	import AudioComparisonViewer from '../../reports-media/AudioComparisonViewer.svelte';
	import EvidenceCard from '../EvidenceCard.svelte';
	import EvidenceViewer from '../EvidenceViewer.svelte';
	import VideoEvidence from '../VideoEvidence.svelte';
	import Select from '../../shared-primitives/Select.svelte';
	let {
		items,
		assetBase,
		idPrefix = ''
	}: {
		items: Evidence[];
		assetBase: string;
		/** Keeps heading ids unique when a page shows a second gallery. */
		idPrefix?: string;
	} = $props();
	let search = $state(''),
		category = $state(''),
		status = $state(''),
		viewport = $state<ScreenSize | ''>(''),
		media = $state<Media>('');
	let selected = $state<Evidence | null>(null);
	let selectedPair = $state<{ before: Evidence; after: Evidence } | null>(null);
	let pairs = $derived(audioPairs(items));
	let browsable = $derived(galleryEvidence(items, pairs));
	let imageCount = $derived(browsable.filter((item) => evidenceMedia(item) === 'image').length);
	let audioCount = $derived(items.filter((item) => evidenceMedia(item) === 'audio').length);
	let videoCount = $derived(items.filter((item) => evidenceMedia(item) === 'video').length);
	let showMedia = $derived(audioCount + videoCount > 0);
	let mediaMode = $derived<Media>(showMedia ? media : '');
	let inMedia = $derived(
		mediaMode ? browsable.filter((item) => evidenceMedia(item) === mediaMode) : browsable
	);
	let categories = $derived([
		...new Set(
			inMedia.flatMap((item) =>
				[item.category, pairs.get(item.id)?.category].filter((name): name is string =>
					Boolean(name)
				)
			)
		)
	]);
	let filtered = $derived(
		reportFilter(inMedia, { search, category, phase: '', status }, pairs).filter(
			(item) => !viewport || screenSize(item) === viewport
		)
	);
	let images = $derived(items.filter((item) => evidenceMedia(item) === 'image'));
	let filteredImages = $derived(filtered.filter((item) => evidenceMedia(item) === 'image'));
	let selectedImage = $derived(selected && evidenceMedia(selected) === 'image' ? selected : null);
	function openItem(item: Evidence) {
		const before = pairs.get(item.id);
		if (before) selectedPair = { before, after: item };
		else if (evidenceMedia(item) === 'image') selected = item;
	}
	function setMedia(next: Media) {
		media = next;
		if (next === 'audio') viewport = '';
		if (category && !categories.includes(category)) category = '';
	}
	function selectItem(item: Evidence, updateViewport = false) {
		selected = item;
		if (updateViewport) {
			const size = screenSize(item);
			viewport = size === 'other' ? '' : size;
			if (!reportFilter([item], { search, category, phase: '', status }).length) {
				search = '';
				category = '';
				status = '';
			}
		} else if (viewport && screenSize(item) !== viewport) {
			const size = screenSize(item);
			viewport = size === 'other' ? '' : size;
		}
	}
</script>

<hx-section class="gallery-section" aria-labelledby={idPrefix + 'gallery-title'}>
	<hx-div class="section-heading">
		<hx-div>
			<hx-h2 id={idPrefix + 'gallery-title'}>{$t(audioCount ? 'mediaGallery' : 'gallery')}</hx-h2>
			<hx-p class="muted">{$t(audioCount ? 'mediaEvidenceNote' : 'evidenceNote')}</hx-p>
		</hx-div>
		<hx-span class="muted"
			>{#if pairs.size}{$t('galleryEntries', {
					values: { shown: filtered.length, total: browsable.length }
				})}{:else}{filtered.length} / {browsable.length}{/if}</hx-span
		>
	</hx-div>
	{#if showMedia}
		<hx-div class="media-tabs" role="group" aria-label={$t('mediaType')}>
			<hx-button class:active={!mediaMode} aria-pressed={!mediaMode} onclick={() => setMedia('')}
				>{$t('allMedia')}</hx-button
			>
			<hx-button
				class:active={mediaMode === 'image'}
				aria-pressed={mediaMode === 'image'}
				onclick={() => setMedia('image')}
				>{$t('screenshots')} <hx-span class="media-count">{imageCount}</hx-span></hx-button
			>
			<hx-button
				class:active={mediaMode === 'audio'}
				aria-pressed={mediaMode === 'audio'}
				onclick={() => setMedia('audio')}
				>{$t('audio')} <hx-span class="media-count">{audioCount}</hx-span></hx-button
			>
			{#if videoCount}<hx-button
					class:active={mediaMode === 'video'}
					aria-pressed={mediaMode === 'video'}
					onclick={() => setMedia('video')}
					>Videos <hx-span class="media-count">{videoCount}</hx-span></hx-button
				>{/if}
		</hx-div>
	{/if}
	<hx-div class="gallery-filters" class:audio-mode={mediaMode === 'audio'}>
		{#if mediaMode !== 'audio'}
			<hx-div class="toolbar viewport-tabs" role="group" aria-label={$t('viewport')}>
				<hx-button
					class:active={!viewport}
					aria-pressed={!viewport}
					aria-label={$t('allScreenSizes')}
					onclick={() => (viewport = '')}>{$t('all')}</hx-button
				>
				{#each ['mobile', 'tablet', 'desktop'] as size}
					<hx-button
						class:active={viewport === size}
						aria-pressed={viewport === size}
						aria-label={$t(size + 'Screenshots')}
						onclick={() => (viewport = size as ScreenSize)}>{$t(size + 'Screenshots')}</hx-button
					>
				{/each}
			</hx-div>
		{/if}
		<hx-div class="toolbar category-tabs" role="group" aria-label={$t('filters')}>
			<hx-button class:active={!category} aria-pressed={!category} onclick={() => (category = '')}
				>{$t('all')}</hx-button
			>
			{#each categories as name}<hx-button
					class:active={category === name}
					aria-pressed={category === name}
					onclick={() => (category = name)}>{name}</hx-button
				>{/each}
		</hx-div>
		<hx-div class="toolbar">
			<hx-input
				bind:value={search}
				placeholder={$t('searchEvidencePlaceholder')}
				aria-label={$t(audioCount ? 'searchMedia' : 'searchEvidence')}
			/>
			<Select bind:value={status} label={$t('status')}
				><hx-option value="">{$t('status')}: {$t('all')}</hx-option
				>{#each ['passed', 'failed', 'blocked', 'skipped', 'not-proven'] as key}<hx-option
						value={key}>{$t(key)}</hx-option
					>{/each}</Select
			>
		</hx-div>
	</hx-div>
	<hx-div class="evidence-grid">
		{#each filtered as item (item.id)}{#if evidenceMedia(item) === 'video'}<VideoEvidence
					{item}
					{assetBase}
				/>{:else}<EvidenceCard
					{item}
					before={pairs.get(item.id)}
					{assetBase}
					onopen={() => openItem(item)}
				/>{/if}{/each}
	</hx-div>
	{#if !filtered.length}<EmptyState as="p" className="empty evidence-grid-empty"
			>{$t('noEvidence')}</EmptyState
		>{/if}
</hx-section>
{#if selectedImage}<EvidenceViewer
		items={images}
		navigableItems={filteredImages}
		selected={selectedImage}
		{assetBase}
		onclose={() => (selected = null)}
		onselect={selectItem}
	/>{/if}
{#if selectedPair}<AudioComparisonViewer
		before={selectedPair.before}
		after={selectedPair.after}
		{assetBase}
		onclose={() => (selectedPair = null)}
	/>{/if}

<style>
	@supports (appearance: base-select) {
		:global(.gallery-filters .report-select select),
		:global(.gallery-filters .report-select select::picker(select)) {
			appearance: base-select;
		}
		:global(.gallery-filters .report-select select::picker(select)) {
			color: var(--hx-color-text);
			background: var(--hx-color-surface);
			border: var(--hx-border-thin) solid var(--hx-color-border);
			border-radius: var(--hx-radius);
		}
		:global(.gallery-filters .report-select select::picker-icon) {
			display: none;
		}
	}
</style>
