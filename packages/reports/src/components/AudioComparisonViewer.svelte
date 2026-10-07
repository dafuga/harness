<script lang="ts">
	import { onMount } from 'svelte';
	import type { Evidence } from '../models/Report.types';
	import { t } from '../utils/reportLocale';
	import AudioEvidence from './AudioEvidence.svelte';
	import Modal from './Modal.svelte';
	type View = 'before' | 'after' | 'compare';
	let {
		before,
		after,
		assetBase,
		onclose
	}: { before: Evidence; after: Evidence; assetBase: string; onclose: () => void } = $props();
	const VIEWS: [View, string, string][] = [
		['before', 'viewBeforeRecording', 'before'],
		['after', 'viewAfterRecording', 'after'],
		['compare', 'compare', 'compare']
	];
	let view = $state<View>('compare');
	let region = $state<HTMLElement>();
	onMount(() => {
		document.querySelectorAll('audio').forEach((audio) => audio.pause());
	});
	let shown = $derived(
		[
			{ item: before, phase: 'before' },
			{ item: after, phase: 'after' }
		].filter(({ phase }) => view === 'compare' || view === phase)
	);
	// Close natively while the dialog is still attached, so the browser returns focus to the opener.
	function close() {
		const dialog = region?.closest('dialog');
		if (dialog?.open) dialog.close();
		onclose();
	}
</script>

<Modal
	open
	title={view === 'before' ? before.title : after.title}
	variant="lightbox"
	onclose={close}
>
	<div class="viewer-actions toolbar audio-comparison-toolbar">
		{#each VIEWS as [key, label, text] (key)}<button
				class:active={view === key}
				aria-pressed={view === key}
				aria-label={$t(label)}
				onclick={() => (view = key)}>{$t(text)}</button
			>{/each}
		<span class="muted">{$t('audioComparisonHint')}</span>
	</div>
	<section
		bind:this={region}
		class="audio-comparison-viewer"
		class:comparison={view === 'compare'}
		aria-label={$t('audioComparisonFor', { values: { title: after.title } })}
	>
		<!-- Keyed by recording: an original leaving the view is destroyed, and AudioEvidence pauses it. -->
		{#each shown as { item, phase } (item.id)}
			<div class="audio-comparison-side" role="group" aria-label={$t(phase + 'Recording')}>
				<span class={'audio-comparison-phase ' + phase} aria-hidden="true">{$t(phase)}</span>
				<AudioEvidence {item} {assetBase} idPrefix="audio-viewer-" />
			</div>
		{/each}
	</section>
</Modal>
