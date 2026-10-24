<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { AudioEvent } from './AudioEvidence.types';

	import { onDestroy } from 'svelte';
	import type { Evidence } from '../../models/reports-media/Report.types';
	import { mediaMime } from '../../utils/verification-evidence/evidenceMedia';
	import { formatDuration } from '../../helpers/strings/formatDuration';
	import { timeAgo } from '../../utils/reports-media/reportDisplay';
	import { t } from '../../utils/reports-media/reportLocale';
	import EvidenceProvenance from './EvidenceProvenance.svelte';
	import StatusBadge from '../shared-primitives/StatusBadge.svelte';
	// A second copy (for example in a viewer) passes its own prefix so HTML ids stay unique.
	let {
		item,
		assetBase,
		idPrefix = 'evidence-'
	}: { item: Evidence; assetBase: string; idPrefix?: string } = $props();
	let player = $state<HTMLAudioElement>();
	// Closing a viewer or switching away must never leave hidden speech running.
	onDestroy(() => player?.pause());
	const EXTENSIONS: Record<string, string> = {
		'audio/mpeg': 'mp3',
		'audio/mp3': 'mp3',
		'audio/wav': 'wav',
		'audio/wave': 'wav',
		'audio/x-wav': 'wav',
		'audio/mp4': 'm4a',
		'audio/x-m4a': 'm4a',
		'audio/ogg': 'ogg'
	};
	let audioError = $state(false);
	let downloadable = $derived(Boolean(item.file && !item.missing));
	let loadedSeconds = $state<number | null>(null);
	let missing = $derived(Boolean(item.missing || !item.file || audioError));
	let src = $derived(assetBase + item.file);
	// Metadata only fills in a missing duration label; it never changes the recorded status.
	let seconds = $derived(validSeconds(item.durationSeconds) ?? loadedSeconds);
	let filename = $derived(downloadName(item));
	// A missing clip shows its note openly, as screenshot cards do; otherwise it stays collapsed.
	let collapsedNote = $derived(missing ? '' : item.note || '');
	let detailsLabel = $derived(
		item.transcript ? (collapsedNote ? 'transcriptAndNotes' : 'transcript') : 'notes'
	);
	function validSeconds(value: number | null | undefined) {
		return value && Number.isFinite(value) && value > 0 ? value : null;
	}
	function fileExtension(evidence: Evidence) {
		const named = evidence.file.startsWith('data:')
			? null
			: /\.(wav|mp3|m4a|ogg)(?:[?#].*)?$/i.exec(evidence.file);
		if (named) return named[1].toLowerCase();
		const mime = (evidence.mimeType || mediaMime(evidence.file)).split(';')[0].trim();
		return EXTENSIONS[mime.toLowerCase()] ?? '';
	}
	function downloadName(evidence: Evidence) {
		const base =
			evidence.title
				.normalize('NFKD')
				.toLowerCase()
				.replace(/[^\p{L}\p{N}]+/gu, '-')
				.slice(0, 80)
				.replace(/^-+|-+$/g, '') || 'audio';
		const extension = fileExtension(evidence);
		const phased = evidence.phase ? `${base}-${evidence.phase}` : base;
		return extension ? `${phased}.${extension}` : phased;
	}
	// Playback is always user initiated; starting one clip pauses the rest so none overlap.
	function pauseOthers(event: AudioEvent) {
		document.querySelectorAll('audio').forEach((audio) => {
			if (audio !== event.currentTarget && !audio.paused) audio.pause();
		});
	}
</script>

<hx-article class="evidence-card audio-card" class:unavailable={missing} id={idPrefix + item.id}>
	<hx-div class="audio-stage">
		<hx-div class="audio-identity">
			<hx-span class="audio-icon" aria-hidden="true"
				><hx-svg
					viewBox="0 0 24 24"
					width="18"
					height="18"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					><hx-svg-path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><hx-svg-path
						d="M15.5 9a4 4 0 0 1 0 6"
					/><hx-svg-path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" /></hx-svg
				></hx-span
			>
			<hx-span>
				<hx-span class="audio-kind"
					>{$t('audio')}{#if item.standing}
						· {item.standing}{:else if item.phase}
						· {$t(item.phase)}{/if}</hx-span
				>
				{#if seconds}<hx-time class="audio-duration" datetime={`PT${Math.round(seconds)}S`}
						>{formatDuration(seconds)}</hx-time
					>{/if}
			</hx-span>
		</hx-div>
		{#if missing}<hx-p class="audio-unavailable">{$t('audioUnavailable')}</hx-p>
		{:else}<hx-audio
				bind:this={player}
				controls
				preload="none"
				{src}
				aria-label={$t('audioFor', { values: { title: item.title } })}
				onplay={pauseOthers}
				onerror={() => (audioError = true)}
				onloadedmetadata={(event) => (loadedSeconds = validSeconds(event.currentTarget.duration))}
			></hx-audio>{/if}
	</hx-div>
	<hx-div class="card-body">
		<hx-div class="card-kicker">
			<hx-span>{item.category}</hx-span><StatusBadge
				status={missing ? 'not-proven' : item.status}
			/>
		</hx-div>
		<hx-h3><hx-a href={'#evidence-' + item.id}>{item.title}</hx-a></hx-h3>
		{#if item.source}<hx-p class="audio-source"
				><hx-span>{$t('source')}</hx-span> {item.source}</hx-p
			>{/if}
		{#if missing && item.note}<hx-p class="muted">{item.note}</hx-p>{/if}
		<EvidenceProvenance {item} />
		{#if item.transcript || collapsedNote}
			<hx-details class="audio-details" open={Boolean(item.transcript)}>
				<hx-summary>{$t(detailsLabel)}</hx-summary>
				{#if collapsedNote}<hx-p>{collapsedNote}</hx-p>{/if}
				{#if item.transcript}
					{#if collapsedNote}<hx-span class="audio-detail-label">{$t('transcript')}</hx-span>{/if}
					<hx-blockquote class="audio-transcript">{item.transcript}</hx-blockquote>
				{/if}
			</hx-details>
		{/if}
		{#if item.capturedAt || downloadable}
			<hx-div class="evidence-meta">
				{#if item.capturedAt}<hx-time datetime={item.capturedAt}>{timeAgo(item.capturedAt)}</hx-time
					>{/if}
				{#if downloadable}<hx-a class="text-link audio-download" href={src} download={filename}
						><hx-span aria-hidden="true">↓</hx-span> {$t('downloadAudio')}</hx-a
					>{/if}
			</hx-div>
		{/if}
	</hx-div>
</hx-article>
