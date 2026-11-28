<!-- @harness-tier organism -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<!-- @harness-uid u_ytdcym5zkw -->
<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import type { VideoEvidenceProps } from './VideoEvidence.types';
	import type { EvidenceVideo } from '../../models/reports-media/Report.types';
	import type { FrameFlag } from '../../../../../src/services/verification-evidence/FrameFlagService.types';
	import EvidenceProvenance from './EvidenceProvenance.svelte';
	import Status from '../shared-primitives/status/Status.svelte';
	import { loadVideoFlags, submitVideoFlag } from './video-evidence/videoFeedback';
	import { videoProvenance } from './video-evidence/videoProvenance';
	let {
		item,
		assetBase,
		initialFlags = [],
		playbackOnly = false,
		metadata
	}: VideoEvidenceProps = $props();
	let player = $state<HTMLVideoElement>();
	let frame = $state(0),
		note = $state(''),
		error = $state(''),
		loading = $state(false),
		settled = $state(false),
		saving = $state(false);
	let flags = $state<FrameFlag[]>(untrack(() => initialFlags)),
		selected = $state<FrameFlag>();
	let submission: AbortController | undefined;
	let video = $derived(item.video);
	let lastFrame = $derived(Math.max(0, (video?.frameCount ?? 1) - 1));
	let shownFlags = $derived(
		flags.filter(
			(flag) =>
				flag.clip.unit === video?.unit &&
				flag.clip.clipId === video?.clipId &&
				flag.clip.viewport === video?.reference?.viewport
		)
	);
	const source = (file: string) =>
		/^(?:https?:|blob:|data:|\/)/.test(file) ? file : assetBase + file;
	const frameImage = (flag: FrameFlag) =>
		'/api/video-flag-frame?' + new URLSearchParams({ unit: flag.clip.unit, id: flag.id });
	const standing = (flag: FrameFlag) => flag.status.charAt(0).toUpperCase() + flag.status.slice(1);
	let details = $derived(videoProvenance(item));
	$effect(() => {
		const current = video,
			controller = new AbortController();
		flags = initialFlags;
		selected = undefined;
		frame = 0;
		error = '';
		loading = false;
		untrack(updatePlayer);
		if (playbackOnly || !current?.reference) return;
		loading = true;
		void refresh(current, controller);
		return () => controller.abort();
	});
	async function refresh(current: EvidenceVideo, controller: AbortController) {
		try {
			const items = await loadVideoFlags(current, controller.signal);
			if (!controller.signal.aborted) flags = items;
		} catch (cause) {
			if (!controller.signal.aborted)
				error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			if (!controller.signal.aborted) loading = false;
		}
	}
	onDestroy(() => {
		player?.pause();
		submission?.abort();
	});
	function seek(next: number, flag?: FrameFlag) {
		frame = Math.max(0, Math.min(lastFrame, Math.floor(next)));
		selected = flag;
		if (player && video) {
			player.pause();
			// Seek inside the frame so browser timestamp rounding cannot select its predecessor.
			player.currentTime = (frame + 0.5) / video.frameRate;
		}
	}
	function currentFrame() {
		if (player && video)
			frame = Math.min(lastFrame, Math.floor(player.currentTime * video.frameRate));
	}
	function updatePlayer() {
		settled = Boolean(player && player.readyState >= 2 && player.paused && !player.seeking);
		currentFrame();
	}
	const canFlag = () =>
		Boolean(
			video?.reference && settled && !saving && !loading && player?.paused && !player.seeking
		);
	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (!canFlag()) return;
		player?.pause();
		currentFrame();
		saving = true;
		error = '';
		const current = video!,
			controller = new AbortController();
		submission?.abort();
		submission = controller;
		try {
			const saved = await submitVideoFlag(current, frame, note, controller.signal);
			if (controller.signal.aborted || current !== video) return;
			flags = [...flags, saved];
			selected = saved;
			note = '';
		} catch (cause) {
			if (!controller.signal.aborted && current === video)
				error = cause instanceof Error ? cause.message : String(cause);
		} finally {
			if (current === video) saving = false;
		}
	}
</script>

<hx-article class="video-evidence" data-harness-component="video-evidence" aria-label={item.title}>
	<hx-header
		><hx-h3>{item.title}</hx-h3>
		{#if metadata}{@render metadata()}{/if}
		{#if !playbackOnly}<Status variant="badge" status={item.status} />{/if}
	</hx-header>
	{#if item.missing || !item.file}<hx-p role="status">{item.note ?? 'No video was recorded.'}</hx-p>
	{:else}<hx-video
			bind:this={player}
			src={source(item.file)}
			poster={video?.poster.url ? source(video.poster.url) : undefined}
			controls
			muted
			preload="metadata"
			playsinline
			ontimeupdate={updatePlayer}
			onloadeddata={updatePlayer}
			onplay={updatePlayer}
			onpause={updatePlayer}
			onseeking={updatePlayer}
			onseeked={updatePlayer}
			onemptied={updatePlayer}
			onerror={() => {
				settled = false;
				error = playbackOnly
					? 'The recorded video could not be played.'
					: 'The recorded video could not be played. Download the original to inspect it.';
			}}
		></hx-video>{/if}
	{#if !playbackOnly}
		{#if video}
			<hx-div class="video-timeline">
				<hx-label
					>Frame timeline<hx-input-range
						aria-label="Frame timeline"
						min="0"
						max={lastFrame}
						step="1"
						value={frame}
						oninput={(event) => seek(Number(event.currentTarget.value))}
					/></hx-label
				>
				<hx-div class="flag-track" aria-label="Flagged frames">
					{#each shownFlags as flag (flag.id)}<hx-button
							type="button"
							class:stale={flag.status === 'stale'}
							style:left={`${Math.min(100, (flag.frameNumber / Math.max(1, lastFrame)) * 100)}%`}
							aria-label={`${standing(flag)} flag at ${flag.atSeconds}s: ${flag.note}`}
							title={`${standing(flag)} · ${flag.atSeconds}s`}
							onclick={() => seek(flag.frameNumber, flag)}
						></hx-button>{/each}
				</hx-div>
				<hx-output aria-live="polite"
					>Frame {frame} · {(frame / video.frameRate).toFixed(2)}s</hx-output
				>
			</hx-div>
		{/if}
		{#if video?.reference && !item.missing}<hx-form onsubmit={save}>
				<hx-label
					>Frame note<hx-textarea
						aria-label="Frame note"
						bind:value={note}
						maxlength="2000"
						rows="2"
					></hx-textarea></hx-label
				>
				<hx-p class="muted">Pause playback and let seeking settle before flagging a frame.</hx-p>
				<hx-button type="submit" disabled={!canFlag()}
					>{saving ? 'Saving frame…' : 'Flag current frame'}</hx-button
				>
			</hx-form>{:else}<hx-p class="muted"
				>No attached clip reference is available for frame feedback.</hx-p
			>{/if}
		{#if loading}<hx-p role="status">Loading frame feedback…</hx-p>{/if}
		{#if shownFlags.length}<hx-ul class="frame-flags" aria-label="Frame feedback">
				{#each shownFlags as flag (flag.id)}<hx-li
						><hx-button type="button" onclick={() => seek(flag.frameNumber, flag)}>
							{standing(flag)} · {flag.atSeconds.toFixed(2)}s</hx-button
						><hx-span>{flag.note || 'No note'}</hx-span></hx-li
					>{/each}
			</hx-ul>{/if}
		{#if selected}<hx-figure
				><hx-img src={frameImage(selected)} alt={`Flagged frame at ${selected.atSeconds}s`} />
				<hx-figcaption>{standing(selected)} · {selected.note}</hx-figcaption></hx-figure
			>{/if}
		{#if item.file && !item.missing}<hx-a href={source(item.file)} target="_blank" rel="noreferrer"
				>Download original video</hx-a
			>{/if}
		<hx-details
			><hx-summary>Clip details</hx-summary><EvidenceProvenance item={details} /></hx-details
		>
	{/if}
	{#if error}<hx-p role="alert">{error}</hx-p>{/if}
</hx-article>

<style>
	@import './video-evidence/videoEvidence.css';
</style>
