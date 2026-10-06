<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Evidence } from '../models/Report.types';
	import { audioDuration, mediaMime } from '../utils/evidenceMedia';
	import { timeAgo } from '../utils/reportDisplay';
	import { t } from '../utils/reportLocale';
	import StatusBadge from './StatusBadge.svelte';
	type AudioEvent = Event & { currentTarget: EventTarget & HTMLAudioElement };
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

<article class="evidence-card audio-card" class:unavailable={missing} id={idPrefix + item.id}>
	<div class="audio-stage">
		<div class="audio-identity">
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
			<span>
				<span class="audio-kind"
					>{$t('audio')}{#if item.phase}
						· {$t(item.phase)}{/if}</span
				>
				{#if seconds}<time class="audio-duration" datetime={`PT${Math.round(seconds)}S`}
						>{audioDuration(seconds)}</time
					>{/if}
			</span>
		</div>
		{#if missing}<p class="audio-unavailable">{$t('audioUnavailable')}</p>
		{:else}<audio
				bind:this={player}
				controls
				preload="none"
				{src}
				aria-label={$t('audioFor', { values: { title: item.title } })}
				onplay={pauseOthers}
				onerror={() => (audioError = true)}
				onloadedmetadata={(event) => (loadedSeconds = validSeconds(event.currentTarget.duration))}
			></audio>{/if}
	</div>
	<div class="card-body">
		<div class="card-kicker">
			<span>{item.category}</span><StatusBadge status={missing ? 'not-proven' : item.status} />
		</div>
		<h3><a href={'#evidence-' + item.id}>{item.title}</a></h3>
		{#if item.source}<p class="audio-source"><span>{$t('source')}</span> {item.source}</p>{/if}
		{#if missing && item.note}<p class="muted">{item.note}</p>{/if}
		{#if item.transcript || collapsedNote}
			<details class="audio-details" open={Boolean(item.transcript)}>
				<summary>{$t(detailsLabel)}</summary>
				{#if collapsedNote}<p>{collapsedNote}</p>{/if}
				{#if item.transcript}
					{#if collapsedNote}<span class="audio-detail-label">{$t('transcript')}</span>{/if}
					<blockquote class="audio-transcript">{item.transcript}</blockquote>
				{/if}
			</details>
		{/if}
		{#if item.capturedAt || downloadable}
			<div class="evidence-meta">
				{#if item.capturedAt}<time datetime={item.capturedAt}>{timeAgo(item.capturedAt)}</time>{/if}
				{#if downloadable}<a class="text-link audio-download" href={src} download={filename}
						><span aria-hidden="true">↓</span> {$t('downloadAudio')}</a
					>{/if}
			</div>
		{/if}
	</div>
</article>
