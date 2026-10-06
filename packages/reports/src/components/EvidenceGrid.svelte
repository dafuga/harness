<script lang="ts">
	import type { Evidence } from '../models/Report.types';
	import type { Report } from '../models/Report.types';
	import { evidenceMedia } from '../utils/evidenceMedia';
	import { audioPairs } from '../utils/audioPairs';
	import { t } from '../utils/reportLocale';
	import {
		galleryEvidence,
		reportFilter,
		screenSize,
		type ScreenSize
	} from '../utils/reportFilter';
	import AudioComparisonViewer from './AudioComparisonViewer.svelte';
	import EvidenceCard from './EvidenceCard.svelte';
	import EvidenceViewer from './EvidenceViewer.svelte';
	import UploadAudio from './UploadAudio.svelte';
	import UploadComparison from './UploadComparison.svelte';
	import Select from './Select.svelte';
	type Media = '' | 'image' | 'audio';
	let {
		items,
		assetBase,
		reportId,
		onUploaded
	}: {
		items: Evidence[];
		assetBase: string;
		reportId?: string;
		onUploaded?: (report: Report) => void;
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

<section class="gallery-section" aria-labelledby="gallery-title">
	<div class="section-heading">
		<div>
			<h2 id="gallery-title">{$t(audioCount ? 'mediaGallery' : 'gallery')}</h2>
			<p class="muted">{$t(audioCount ? 'mediaEvidenceNote' : 'evidenceNote')}</p>
		</div>
		<span class="muted"
			>{#if pairs.size}{$t('galleryEntries', {
					values: { shown: filtered.length, total: browsable.length }
				})}{:else}{filtered.length} / {browsable.length}{/if}</span
		>
	</div>
	{#if reportId && onUploaded}
		<UploadComparison {reportId} {onUploaded} />
		<UploadAudio {reportId} {onUploaded} />
	{/if}
	{#if showMedia}
		<div class="media-tabs" role="group" aria-label={$t('mediaType')}>
			<button class:active={!mediaMode} aria-pressed={!mediaMode} onclick={() => setMedia('')}
				>{$t('allMedia')}</button
			>
			<button
				class:active={mediaMode === 'image'}
				aria-pressed={mediaMode === 'image'}
				onclick={() => setMedia('image')}
				>{$t('screenshots')} <span class="media-count">{imageCount}</span></button
			>
			<button
				class:active={mediaMode === 'audio'}
				aria-pressed={mediaMode === 'audio'}
				onclick={() => setMedia('audio')}
				>{$t('audio')} <span class="media-count">{audioCount}</span></button
			>
		</div>
	{/if}
	<div class="gallery-filters" class:audio-mode={mediaMode === 'audio'}>
		{#if mediaMode !== 'audio'}
			<div class="toolbar viewport-tabs" role="group" aria-label={$t('viewport')}>
				<button
					class:active={!viewport}
					aria-pressed={!viewport}
					aria-label={$t('allScreenSizes')}
					onclick={() => (viewport = '')}>{$t('all')}</button
				>
				{#each ['mobile', 'tablet', 'desktop'] as size}
					<button
						class:active={viewport === size}
						aria-pressed={viewport === size}
						aria-label={$t(size + 'Screenshots')}
						onclick={() => (viewport = size as ScreenSize)}>{$t(size + 'Screenshots')}</button
					>
				{/each}
			</div>
		{/if}
		<div class="toolbar category-tabs" role="group" aria-label={$t('filters')}>
			<button class:active={!category} aria-pressed={!category} onclick={() => (category = '')}
				>{$t('all')}</button
			>
			{#each categories as name}<button
					class:active={category === name}
					aria-pressed={category === name}
					onclick={() => (category = name)}>{name}</button
				>{/each}
		</div>
		<div class="toolbar">
			<input
				bind:value={search}
				placeholder={$t(audioCount ? 'searchMedia' : 'searchEvidence')}
				aria-label={$t(audioCount ? 'searchMedia' : 'searchEvidence')}
			/>
			<Select bind:value={status} label={$t('status')}
				><option value="">{$t('status')}: {$t('all')}</option
				>{#each ['passed', 'failed', 'blocked', 'skipped', 'not-proven'] as key}<option value={key}
						>{$t(key)}</option
					>{/each}</Select
			>
		</div>
	</div>
	<div class="evidence-grid">
		{#each filtered as item (item.id)}<EvidenceCard
				{item}
				before={pairs.get(item.id)}
				{assetBase}
				onopen={() => openItem(item)}
			/>{/each}
	</div>
	{#if !filtered.length}<p class="empty">{$t('noEvidence')}</p>{/if}
</section>
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
