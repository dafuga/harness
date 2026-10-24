<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script module lang="ts">
	import { replayLocale } from './replayLocale';
	replayLocale();
</script>
<script lang="ts">
	import '../../../lib/styles/replay.css';
	import type { Report } from '../../../models/reports-media/Report.types';
	import { reportDisplay } from './reportDisplay';
	import { t } from '../../../utils/reports-media/reportLocale';
	import {
		FRAME_SECONDS,
		replayFrames,
		type ReplayFrame as Frame
	} from '../../../utils/reports-media/replayFrames';
	import { replayStart } from './replayFrames';
	import { replayScenes, replayCursorIndex, replayNotice } from './replayPresentation';
	import ReplayControls from '../ReplayControls.svelte';
	import StatusBadge from '../../shared-primitives/StatusBadge.svelte';
	let {
		report,
		assetBase,
		portable = false
	}: { report: Report; assetBase: string; portable?: boolean } = $props();
	let frames: Frame[] = $derived(replayFrames(report.evidence));
	let display = $derived(reportDisplay(report));
	let live = $derived(report.state === 'active' && display === 'running');
	// The cursor follows a frame id, so frames arriving with each refresh never move it.
	let cursor = $state<{ id: string | null; index: number }>({ id: null, index: 0 });
	let index = $derived(replayCursorIndex(frames, cursor));
	let current = $derived<Frame | undefined>(frames[index]);
	let last = $derived<Frame | undefined>(frames[frames.length - 1]);
	let offset = $state(0);
	let playing = $state(false);
	let speed = $state(1);
	let loadState = $state<Record<string, 'ready' | 'error'>>({});
	let retryToken = $state(0);
	let status = $derived(current ? (loadState[current.item.id] ?? 'loading') : 'loading');
	let total = $derived(last ? last.start + last.duration : 0);
	let elapsed = $derived(current ? current.start + Math.min(offset, current.duration) : 0);
	let atEnd = $derived(Boolean(current && current === last && offset >= current.duration));
	let scenes = $derived(replayScenes(frames));
	let player = $state<HTMLElement>();
	let native = $state(false);
	let expanded = $state(false);
	let exporting = $state(false);
	let exportTimer: ReturnType<typeof setTimeout> | undefined;
	const warmed = new Set<string>();
	let videoHref = $derived('/api/replay-video?run=' + encodeURIComponent(report.id));
	let notice = $derived(replayNotice({ exporting, atEnd, live, playing }, $t));
	function go(target: number) {
		const next = Math.max(0, Math.min(target, frames.length - 1));
		if (!frames[next]) return;
		cursor = { id: frames[next].item.id, index: next };
		offset = 0;
	}
	function advance(delta: number) {
		if (!current || status === 'loading') return;
		if (offset + delta < current.duration) {
			offset += delta;
		} else if (current !== last) {
			go(index + 1);
		} else {
			// Live runs wait here and resume as soon as the next capture arrives.
			offset = current.duration;
			if (!live) playing = false;
		}
	}
	function toggle() {
		if (!playing && atEnd && !live) go(replayStart(frames));
		if (!cursor.id && current) cursor = { id: current.item.id, index };
		playing = !playing;
	}
	function retry() {
		if (current) delete loadState[current.item.id];
		retryToken += 1;
	}
	async function toggleFullscreen() {
		if (native || expanded) {
			expanded = false;
			if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
			return;
		}
		expanded = true;
		await player?.requestFullscreen?.().catch(() => undefined);
	}
	function prepareExport() {
		exporting = true;
		clearTimeout(exportTimer);
		exportTimer = setTimeout(() => (exporting = false), 8000);
	}
	// Wall-clock playback that holds while the current screenshot is still loading.
	$effect(() => {
		if (!playing) return;
		let before = performance.now();
		let handle = requestAnimationFrame(function step(now) {
			advance((Math.min(now - before, 250) / 1000) * speed);
			before = now;
			handle = requestAnimationFrame(step);
		});
		return () => cancelAnimationFrame(handle);
	});
	$effect(() => {
		const next = frames[index + 1];
		if (!next || warmed.has(next.item.id)) return;
		warmed.add(next.item.id);
		const image = new Image();
		image.onload = () => {
			if (!loadState[next.item.id]) loadState[next.item.id] = 'ready';
		};
		image.src = assetBase + next.item.file;
	});
	$effect(() => () => clearTimeout(exportTimer));
	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') expanded = false;
	}
</script>
<svelte:document
	onfullscreenchange={() => (native = !!player && document.fullscreenElement === player)}
/>
<svelte:window {onkeydown} />
{#if current || live}
	<hx-section class="replay-section" aria-labelledby="replay-title">
		<hx-div class="section-heading replay-heading">
			<hx-div>
				<hx-h2 id="replay-title">{$t('replay.heading')}</hx-h2>
				<hx-p class="muted replay-subtitle">
					{$t('replay.subtitle', { values: { seconds: FRAME_SECONDS } })}
				</hx-p>
			</hx-div>
			<hx-div class="replay-meta">
				{#if live}<hx-span class="badge running"
						><hx-span class="replay-pulse" aria-hidden="true">●</hx-span>
						{$t('replay.recording')}</hx-span
					>
				{:else if display === 'interrupted'}<StatusBadge status="interrupted" />
				{:else}<hx-span class="badge">{$t('replay.complete')}</hx-span>{/if}
				<!-- The MP4 is generated on request from the same frames; the portable report has no server. -->
				{#if current && !portable}<hx-a
						class="button"
						href={videoHref}
						download
						onclick={prepareExport}
						title={$t('replay.downloadHint', { values: { seconds: FRAME_SECONDS } })}
						><hx-span aria-hidden="true">↓</hx-span> {$t('replay.download')}</hx-a
					>{/if}
			</hx-div>
		</hx-div>
		{#if current}
			<hx-div
				class="replay-player"
				class:full={native || expanded}
				bind:this={player}
				role="region"
				aria-label={$t('replay.player')}
			>
				<hx-div class="replay-stage">
					<!-- Keyed per frame, so a previous screenshot never lingers under a new title. -->
					{#each [current] as frame (`${frame.item.id}:${retryToken}`)}<hx-img
							src={assetBase + frame.item.file}
							alt={frame.item.title}
							class:ready={status === 'ready'}
							onload={() => (loadState[frame.item.id] = 'ready')}
							onerror={() => (loadState[frame.item.id] = 'error')}
						/>{/each}
					{#if status === 'loading'}
						<hx-div class="replay-overlay pending">{$t('replay.loading')}</hx-div>
					{:else if status === 'error'}
						<hx-div class="replay-overlay replay-error">
							<hx-span>{$t('replay.error')}</hx-span>
							<hx-div class="toolbar">
								<hx-button type="button" onclick={retry}>{$t('replay.retry')}</hx-button>
								{#if current !== last}<hx-button type="button" onclick={() => go(index + 1)}
										>{$t('replay.skip')}</hx-button
									>{/if}
							</hx-div>
						</hx-div>
					{/if}
				</hx-div>
				<hx-div class="replay-caption">
					<hx-h3>{current.item.title}</hx-h3>
					<hx-span class="replay-frame">
						{#if current.scene !== null}<hx-span class="replay-scene"
								>{$t('replay.sceneValue', { values: { scene: current.scene } })}</hx-span
							>{/if}
						{$t('replay.frameCount', { values: { frame: index + 1, count: frames.length } })}
					</hx-span>
				</hx-div>
				<ReplayControls
					bind:speed
					{playing}
					{index}
					count={frames.length}
					{elapsed}
					{total}
					title={current.item.title}
					scene={current.scene}
					{scenes}
					fullscreen={native || expanded}
					ontoggle={toggle}
					onseek={go}
					onscene={(scene) => go(frames.findIndex((frame) => frame.scene === scene))}
					onfullscreen={toggleFullscreen}
				/>
				<hx-p class="muted replay-status" aria-live="polite">{notice}</hx-p>
			</hx-div>
		{:else}
			<hx-div class="replay-stage replay-empty">
				<hx-div class="replay-overlay">
					<hx-span class="replay-pulse" aria-hidden="true">●</hx-span>
					<hx-strong>{$t('replay.emptyTitle')}</hx-strong>
					<hx-span>{$t('replay.emptyBody')}</hx-span>
				</hx-div>
			</hx-div>
		{/if}
	</hx-section>
{/if}
