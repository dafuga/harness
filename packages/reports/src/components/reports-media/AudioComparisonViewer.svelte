<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import ComparePanes from '../shared-primitives/ComparePanes.svelte';
	import { comparisonPanes } from '../../helpers/verification-evidence/comparisonPanes';
	import type { View } from './AudioComparisonViewer.types';

	import { onMount } from 'svelte';
	import type { Evidence } from '../../models/reports-media/Report.types';
	import { t } from '../../utils/reports-media/reportLocale';
	import AudioEvidence from '../verification-evidence/AudioEvidence.svelte';
	import Modal from '../shared-primitives/Modal.svelte';
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
	const panes = $derived(
		comparisonPanes(
			{ value: before, commit: before.source, key: before.id },
			{ value: after, commit: after.source, key: after.id }
		)
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
	<hx-div class="viewer-actions toolbar audio-comparison-toolbar">
		{#each VIEWS as [key, label, text] (key)}<hx-button
				class:active={view === key}
				aria-pressed={view === key}
				aria-label={$t(label)}
				onclick={() => (view = key)}>{$t(text)}</hx-button
			>{/each}
		<hx-span class="muted">{$t('audioComparisonHint')}</hx-span>
	</hx-div>
	<hx-section
		bind:this={region}
		class="audio-comparison-viewer"
		class:comparison={view === 'compare'}
		aria-label={$t('audioComparisonFor', { values: { title: after.title } })}
	>
		<!-- Keyed by recording: an original leaving the view is destroyed, and AudioEvidence pauses it. -->

		<ComparePanes {panes} visible={view === 'compare' ? 'both' : view} framed={false} contents>
			{#snippet children(pane)}
				{#if pane.value}<hx-div
						class="audio-comparison-side"
						role="group"
						aria-label={$t(pane.side + 'Recording')}
					>
						<hx-span class={'audio-comparison-phase ' + pane.side} aria-hidden="true"
							>{pane.heading}</hx-span
						>
						<AudioEvidence item={pane.value} {assetBase} idPrefix="audio-viewer-" />
					</hx-div>{/if}
			{/snippet}
		</ComparePanes>
	</hx-section>
</Modal>
