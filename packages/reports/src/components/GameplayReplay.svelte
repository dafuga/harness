<script module lang="ts">
	import { replayLocale } from '../utils/replayLocale';
	replayLocale();
</script>

<script lang="ts">
	import '../lib/styles/replay.css';
	import type { Report } from '../models/Report.types';
	import { reportDisplay } from '../utils/reportDisplay';
	import { t } from '../utils/reportLocale';
	import { FRAME_SECONDS, replayFrames, replayStart, type ReplayFrame as Frame } from '../utils/replayFrames';
	import ReplayControls from './ReplayControls.svelte';
	import StatusBadge from './StatusBadge.svelte';
	let { report, assetBase, portable = false }: { report: Report; assetBase: string; portable?: boolean } = $props();
	let frames: Frame[] = $derived(replayFrames(report.evidence));
	let display = $derived(reportDisplay(report));
	let live = $derived(report.state === 'active' && display === 'running');
	// The cursor follows a frame id, so frames arriving with each refresh never move it.
	let cursor = $state<{ id: string | null; index: number }>({ id: null, index: 0 });
	let index = $derived.by(() => {
		const found = frames.findIndex((frame) => frame.item.id === cursor.id);
		const start = cursor.id === null ? replayStart(frames) : cursor.index;
		return found >= 0 ? found : Math.min(start, Math.max(frames.length - 1, 0));
	});
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
	let scenes = $derived(
		[...new Set(frames.flatMap((frame) => (frame.scene === null ? [] : [frame.scene])))].sort((a, b) => a - b)
	);
	let player = $state<HTMLElement>();
	let native = $state(false);
	let expanded = $state(false);
	let exporting = $state(false);
	let exportTimer: ReturnType<typeof setTimeout> | undefined;
	const warmed = new Set<string>();
	let videoHref = $derived('/api/replay-video?run=' + encodeURIComponent(report.id));
	let notice = $derived.by(() => {
		if (exporting) return $t('replay.preparing');
		if (!atEnd) return '';
		if (live) return playing ? $t('replay.waiting') : '';
		return $t('replay.ended');
	});
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

<svelte:document onfullscreenchange={() => (native = !!player && document.fullscreenElement === player)} />
<svelte:window {onkeydown} />

{#if current || live}
	<section class="replay-section" aria-labelledby="replay-title">
		<div class="section-heading replay-heading">
			<div>
				<h2 id="replay-title">{$t('replay.heading')}</h2>
				<p class="muted replay-subtitle">
					{$t('replay.subtitle', { values: { seconds: FRAME_SECONDS } })}
				</p>
			</div>
			<div class="replay-meta">
				{#if live}<span class="badge running"
						><span class="replay-pulse" aria-hidden="true">●</span> {$t('replay.recording')}</span
					>
				{:else if display === 'interrupted'}<StatusBadge status="interrupted" />
				{:else}<span class="badge">{$t('replay.complete')}</span>{/if}
				<!-- The MP4 is generated on request from the same frames; the portable report has no server. -->
				{#if current && !portable}<a
						class="button"
						href={videoHref}
						download
						onclick={prepareExport}
						title={$t('replay.downloadHint', { values: { seconds: FRAME_SECONDS } })}
						><span aria-hidden="true">↓</span> {$t('replay.download')}</a
					>{/if}
			</div>
		</div>
		{#if current}
			<div
				class="replay-player"
				class:full={native || expanded}
				bind:this={player}
				role="region"
				aria-label={$t('replay.player')}
			>
				<div class="replay-stage">
					<!-- Keyed per frame, so a previous screenshot never lingers under a new title. -->
					{#each [current] as frame (`${frame.item.id}:${retryToken}`)}<img
							src={assetBase + frame.item.file}
							alt={frame.item.title}
							class:ready={status === 'ready'}
							onload={() => (loadState[frame.item.id] = 'ready')}
							onerror={() => (loadState[frame.item.id] = 'error')}
						/>{/each}
					{#if status === 'loading'}
						<div class="replay-overlay pending">{$t('replay.loading')}</div>
					{:else if status === 'error'}
						<div class="replay-overlay replay-error">
							<span>{$t('replay.error')}</span>
							<div class="toolbar">
								<button type="button" onclick={retry}>{$t('replay.retry')}</button>
								{#if current !== last}<button type="button" onclick={() => go(index + 1)}>{$t('replay.skip')}</button
									>{/if}
							</div>
						</div>
					{/if}
				</div>
				<div class="replay-caption">
					<h3>{current.item.title}</h3>
					<span class="replay-frame">
						{#if current.scene !== null}<span class="replay-scene"
								>{$t('replay.sceneValue', { values: { scene: current.scene } })}</span
							>{/if}
						{$t('replay.frameCount', { values: { frame: index + 1, count: frames.length } })}
					</span>
				</div>
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
				<p class="muted replay-status" aria-live="polite">{notice}</p>
			</div>
		{:else}
			<div class="replay-stage replay-empty">
				<div class="replay-overlay">
					<span class="replay-pulse" aria-hidden="true">●</span>
					<strong>{$t('replay.emptyTitle')}</strong>
					<span>{$t('replay.emptyBody')}</span>
				</div>
			</div>
		{/if}
	</section>
{/if}
