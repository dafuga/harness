<script lang="ts">
	import { onMount } from 'svelte';
	import type { Evidence } from '../models/Report.types';
	import { audioDuration } from '../utils/evidenceMedia';
	import { t } from '../utils/reportLocale';
	import StatusBadge from './StatusBadge.svelte';
	let { before, after, onopen }: { before: Evidence; after: Evidence; onopen: () => void } =
		$props();
	let ready = $state(false);
	onMount(() => {
		ready = true;
	});
	// The Before summary keeps the original's gallery anchor, so existing deep links still land here.
	let phases = $derived([
		{ item: before, phase: 'before', anchor: 'evidence-' + before.id },
		{ item: after, phase: 'after', anchor: undefined }
	]);
	let summaryId = $derived('audio-comparison-' + after.id);
	function unavailable(item: Evidence) {
		return Boolean(item.missing || !item.file);
	}
	function seconds(item: Evidence) {
		const value = item.durationSeconds;
		return value && Number.isFinite(value) && value > 0 ? value : null;
	}
</script>

<!-- One gallery card; each original keeps its own status and the pair never gets a combined one. -->
<article class="evidence-card audio-comparison-card" id={'evidence-' + after.id}>
	<button
		class="audio-comparison-preview"
		disabled={!ready}
		onclick={onopen}
		aria-label={$t('openAudioComparison', { values: { title: after.title } })}
		aria-describedby={summaryId}
	>
		<span class="audio-identity">
			<span class="audio-icon" aria-hidden="true"
				><svg
					viewBox="0 0 24 24"
					width="18"
					height="18"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6" /><path
						d="M18.5 6.5a7.5 7.5 0 0 1 0 11"
					/></svg
				></span
			>
			<span class="audio-kind">{$t('audio')} · {$t('pairedRecordings')}</span>
		</span>
		<span class="audio-comparison-phases" id={summaryId}>
			{#each phases as { item, phase, anchor } (phase)}
				{@const length = seconds(item)}
				<span class="audio-comparison-row" id={anchor}>
					<span class={'audio-comparison-phase ' + phase}>{$t(phase)}</span>
					{#if unavailable(item)}<span class="audio-comparison-missing"
							>{$t('audioUnavailable')}</span
						>
					{:else if length}<time class="audio-duration" datetime={`PT${Math.round(length)}S`}
							>{audioDuration(length)}</time
						>{/if}
					<StatusBadge status={unavailable(item) ? 'not-proven' : item.status} />
				</span>
			{/each}
		</span>
		<span class="audio-comparison-open">↗ {$t('listenAndCompare')}</span>
	</button>
	<div class="card-body">
		<div class="card-kicker"><span>{after.category}</span></div>
		<h3><a href={'#evidence-' + after.id}>{after.title}</a></h3>
	</div>
</article>
