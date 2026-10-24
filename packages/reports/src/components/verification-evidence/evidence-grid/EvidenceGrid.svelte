<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import type { Media } from './EvidenceGrid.types';

	import type { Evidence } from '../../../models/reports-media/Report.types';
	import type { Report } from '../../../models/reports-media/Report.types';
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
	import UploadAudio from '../../reports-media/UploadAudio.svelte';
	import UploadComparison from '../../shared-primitives/UploadComparison.svelte';
	import Select from '../../shared-primitives/Select.svelte';
	let {
		items,
		assetBase,
		reportId,
		onUploaded,
		idPrefix = ''
	}: {
		items: Evidence[];
		assetBase: string;
		reportId?: string;
		onUploaded?: (report: Report) => void;
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
	// Screenshot-only reports that cannot upload keep the original gallery exactly as before.
	let showMedia = $derived(audioCount > 0 || Boolean(reportId && onUploaded));
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
	// The viewer stays screenshot-only: audio never reaches ImageZoom or arrow-key navigation.
	let images = $derived(items.filter((item) => evidenceMedia(item) === 'image'));
	let filteredImages = $derived(filtered.filter((item) => evidenceMedia(item) === 'image'));
	let selectedImage = $derived(selected && evidenceMedia(selected) === 'image' ? selected : null);
	// Paired audio opens its own viewer; only screenshots ever reach EvidenceViewer.
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
	{#if reportId && onUploaded}
		<UploadComparison {reportId} {onUploaded} />
		<UploadAudio {reportId} {onUploaded} />
	{/if}
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
				placeholder={$t(audioCount ? 'searchMedia' : 'searchEvidence')}
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
		{#each filtered as item (item.id)}<EvidenceCard
				{item}
				before={pairs.get(item.id)}
				{assetBase}
				onopen={() => openItem(item)}
			/>{/each}
	</hx-div>
	{#if !filtered.length}<hx-p class="empty">{$t('noEvidence')}</hx-p>{/if}
</hx-section>
<EvidenceViewer
	items={images}
	navigableItems={filteredImages}
	selected={selectedImage}
	{assetBase}
	onclose={() => (selected = null)}
	onselect={selectItem}
/>
{#if selectedPair}<AudioComparisonViewer
		before={selectedPair.before}
		after={selectedPair.after}
		{assetBase}
		onclose={() => (selectedPair = null)}
	/>{/if}
