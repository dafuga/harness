<script lang="ts">
	import { audioDuration } from '../utils/evidenceMedia';
	import { REPLAY_SPEEDS } from '../utils/replayFrames';
	import { t } from '../utils/reportLocale';
	import Select from './Select.svelte';
	let {
		playing,
		index,
		count,
		elapsed,
		total,
		title,
		scene,
		scenes,
		fullscreen,
		speed = $bindable(1),
		ontoggle,
		onseek,
		onscene,
		onfullscreen
	}: {
		playing: boolean;
		index: number;
		count: number;
		elapsed: number;
		total: number;
		title: string;
		scene: number | null;
		scenes: number[];
		fullscreen: boolean;
		speed?: number;
		ontoggle: () => void;
		onseek: (index: number) => void;
		onscene: (scene: number) => void;
		onfullscreen: () => void;
	} = $props();
	let last = $derived(Math.max(count - 1, 0));
	const icons = {
		play: 'M8 5v14l11-7z',
		pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
		previous: 'M6 6h2v12H6zm3.5 6 8.5 6V6z',
		next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
		latest: 'M5.59 7.41 10.18 12l-4.59 4.59L7 18l6-6-6-6zM16 6h2v12h-2z',
		enter: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
		exit: 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z'
	};
</script>

{#snippet icon(path: string)}<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
		><path d={path} /></svg
	>{/snippet}

<div class="replay-controls">
	<!-- One step per screenshot: arrows, Home and End move between captured frames. -->
	<div class="replay-timeline">
		<input
			type="range"
			min="0"
			max={last}
			step="1"
			value={index}
			disabled={count < 2}
			aria-label={$t('replay.timeline')}
			aria-valuetext={$t('replay.timelineValue', { values: { frame: index + 1, count, title } })}
			oninput={(event) => onseek(Number(event.currentTarget.value))}
		/>
		<span class="replay-time"
			>{$t('replay.time', {
				values: { elapsed: audioDuration(elapsed), total: audioDuration(total) }
			})}</span
		>
	</div>
	<div class="replay-bar">
		<div class="replay-transport" role="group" aria-label={$t('replay.transport')}>
			<button
				type="button"
				aria-label={$t('replay.previous')}
				title={$t('replay.previous')}
				disabled={index <= 0}
				onclick={() => onseek(index - 1)}>{@render icon(icons.previous)}</button
			>
			<button type="button" class="replay-play" onclick={ontoggle}
				>{@render icon(playing ? icons.pause : icons.play)}
				{$t(playing ? 'replay.pause' : 'replay.play')}</button
			>
			<button
				type="button"
				aria-label={$t('replay.next')}
				title={$t('replay.next')}
				disabled={index >= last}
				onclick={() => onseek(index + 1)}>{@render icon(icons.next)}</button
			>
		</div>
		<label class="replay-field">
			<span>{$t('replay.speed')}</span>
			<Select
				label={$t('replay.speed')}
				bind:value={() => String(speed), (value) => (speed = Number(value))}
			>
				{#each REPLAY_SPEEDS as value}<option value={String(value)}
						>{$t('replay.speedValue', { values: { speed: value } })}</option
					>{/each}
			</Select>
		</label>
		{#if scenes.length}
			<label class="replay-field">
				<span>{$t('replay.scene')}</span>
				<Select
					label={$t('replay.scene')}
					bind:value={() => String(scene ?? ''), (value) => onscene(Number(value))}
				>
					{#if scene === null}<option value="" disabled>{$t('replay.noScene')}</option>{/if}
					{#each scenes as value}<option value={String(value)}
							>{$t('replay.sceneValue', { values: { scene: value } })}</option
						>{/each}
				</Select>
			</label>
		{/if}
		<div class="replay-end">
			<button type="button" disabled={index >= last} onclick={() => onseek(last)}
				>{@render icon(icons.latest)} {$t('replay.latest')}</button
			>
			<button
				type="button"
				aria-label={$t(fullscreen ? 'replay.exitFullscreen' : 'replay.fullscreen')}
				title={$t(fullscreen ? 'replay.exitFullscreen' : 'replay.fullscreen')}
				onclick={onfullscreen}>{@render icon(fullscreen ? icons.exit : icons.enter)}</button
			>
		</div>
	</div>
</div>
