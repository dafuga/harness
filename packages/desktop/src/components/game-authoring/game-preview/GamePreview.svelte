<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { GamePreviewProps as Props } from '../../../models/game-authoring/GamePreview.types';
	import Select from '$shared/Select.svelte';
	import GameLiveVideo from '../GameLiveVideo.svelte';
	import GameControls from '../GameControls.svelte';
	import { gameRenderOptions } from './gameRenderOptions';
	const models = gameRenderOptions();
	import { createRun, create3d, draw2d, stepGame } from '../../../../../game/src/index';
	import type { GameInput, GameRun } from '../../../../../game/src/index';
	import * as aiVideo from '../../../../../game/src/adapters/agents-providers/DecartStreamAdapter';
	const [cap, speed, tick] = [60, 0.05, 1000 / 60];
	let { view, projectId, readonly = false, onRun, bridge, initialRun }: Props = $props();
	let run = $state.raw<GameRun>(createRun());
	let flat = $state<HTMLCanvasElement>();
	let deep = $state<HTMLCanvasElement>();
	let scene = $state.raw<ReturnType<typeof create3d>>();
	let choice = $state('restyle');
	let status = $state<'off' | 'starting' | 'live'>('off');
	let note = $state('');
	let error = $state('');
	let left = $state(cap);
	let live: Awaited<ReturnType<typeof aiVideo.connectDecart>> | undefined;
	let stream = $state.raw<MediaStream>();
	let timer: ReturnType<typeof setInterval> | undefined;
	let abort: AbortController | undefined;
	let [generation, frame, last, carry] = [0, 0, 0, 0];
	const held = new SvelteSet<string>();
	const pick = $derived(models[choice as keyof typeof models] ?? models.restyle);
	const available = $derived(
		Boolean(aiVideo.decartTransportReady() && !readonly && projectId && bridge?.gameRender)
	);
	const busy = $derived(status !== 'off');
	const scope = $derived(view.id + ':' + view.dimension + ':' + view.planning?.built);
	const summary = $derived.by(() => {
		if (!aiVideo.decartTransportReady()) return 'Live AI is not configured for this build.';
		if (!available) return 'AI video needs a saved project open in the desktop app.';
		if (busy) return status === 'live' ? `Live · ${left} s left` : 'Starting the AI video…';
		return note || `Runs at most ${cap} s, so it costs at most $${pick.rate.toFixed(2)}.`;
	});
	$effect(() => {
		const style = view.style;
		untrack(() => live?.setPrompt(style));
	});
	const keyup = (event: KeyboardEvent) => held.delete(event.key);

	function step(input: GameInput) {
		run = stepGame(run, input, view);
		onRun(run);
	}
	function reset() {
		run = createRun(1, view);
		onRun(run);
	}
	function atSpawn(next: GameRun): GameRun {
		if (!view.world || next.state.level === view.id + ':' + view.planning?.built) return next;
		const { spawn } = view.world;
		const state = {
			...next.state,
			x: spawn.x,
			y: spawn.z,
			level: view.id + ':' + view.planning?.built,
			view: view.id
		};
		return { ...next, viewId: view.id, state };
	}

	function keydown(event: KeyboardEvent) {
		const target = event.target instanceof Element ? event.target : null;
		if (!event.key.startsWith('Arrow') || target?.matches('input, textarea, select')) return;
		event.preventDefault();
		held.add(event.key);
		if (frame) return;
		[last, carry] = [performance.now(), 0];
		frame = requestAnimationFrame(loop);
	}
	function loop(now: number) {
		carry = Math.min(Math.max(0, carry + now - last), tick * 4);
		last = now;
		const x = Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft'));
		const y = Number(held.has('ArrowDown')) - Number(held.has('ArrowUp'));
		for (; carry >= tick; carry -= tick) if (x || y) step({ x: x * speed, y: y * speed });
		frame = held.size ? requestAnimationFrame(loop) : 0;
	}
	function halt(reason: string) {
		generation++;
		abort?.abort();
		live?.stop();
		clearInterval(timer);
		live = undefined;
		stream = undefined;
		status = 'off';
		note = reason;
	}
	function hidden() {
		if (document.hidden && busy) halt('Stopped because the page was hidden.');
	}
	function countdown() {
		left = cap;
		timer = setInterval(() => {
			left -= 1;
			if (left <= 0) halt('Stopped at the 60 second limit.');
			else if (live?.ended() || stream?.getTracks().every((track) => track.readyState === 'ended'))
				halt('The AI video ended.');
		}, 1000);
	}
	async function start() {
		const canvas = deep ?? flat;
		if (!canvas || !projectId || !bridge?.gameRender || busy || readonly) return;
		const id = ++generation;
		const { model, fast } = pick;
		status = 'starting';
		note = '';
		error = '';
		try {
			const session = await bridge.gameRender({ projectId, model, fast, seconds: cap });
			if (id !== generation) return;
			countdown();
			abort = new AbortController();
			const connection = await aiVideo.connectDecart(
				canvas,
				session,
				{ prompt: view.style, signal: abort.signal },
				(remote) => {
					if (id !== generation) return remote.getTracks().forEach((track) => track.stop());
					stream = remote;
					status = 'live';
				}
			);
			if (id !== generation) return connection.stop();
			live = connection;
		} catch (cause) {
			if (id !== generation) return;
			halt('');
			error = cause instanceof Error ? cause.message : 'The AI video could not start.';
		}
	}
	$effect(() => {
		if (!deep) return;
		const made = create3d(deep);
		scene = made;
		return () => {
			made.dispose();
			scene = undefined;
		};
	});
	$effect(() => {
		if (view.dimension === '3d') scene?.render(run, view);
		else if (flat) draw2d(flat, run, view);
	});
	let shown = '';
	$effect(() => {
		if (scope === shown) return;
		shown = scope;
		untrack(() => {
			halt('');
			run = atSpawn(initialRun ?? createRun(1, view));
			onRun(run);
		});
	});
	onDestroy(() => {
		halt('');
		cancelAnimationFrame(frame);
	});
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} onblur={() => held.clear()} />
<svelte:document onvisibilitychange={hidden} />

<section data-harness-component="game-preview" data-readonly={readonly}>
	<div class="stage">
		{#if view.dimension === '3d'}
			<canvas bind:this={deep} width="1280" height="704" aria-label={view.title}></canvas>
		{:else}
			<canvas bind:this={flat} width="1280" height="704" aria-label={view.title}></canvas>
		{/if}
		{#if busy}
			<GameLiveVideo {stream} />
		{/if}
	</div>
	<!-- The readout stays outside the canvas, so the AI capture never includes it. -->
	<GameControls {view} {run} {step} {reset} />
	<div class="row">
		<Select label="AI video model" bind:value={choice} disabled={!available || busy}>
			{#each Object.entries(models) as [key, item] (key)}
				<option value={key}>{item.label} · ${item.rate.toFixed(2)}/min</option>
			{/each}
		</Select>
		{#if busy}
			<button onclick={() => halt('Stopped.')}>Stop AI video</button>
		{:else}
			<button class="gold" disabled={!available} onclick={start}>Start AI video</button>
		{/if}
		<small role="status">{summary}</small>
	</div>
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.stage {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: var(--hx-space-14);
	}
	canvas {
		width: 100%;
		aspect-ratio: 1280 / 704;
		border: var(--hx-border-thin) solid var(--line);
		border-radius: var(--hx-radius-large);
		background: var(--hx-bg);
	}
	.row {
		flex-wrap: wrap;
		margin-top: var(--hx-space-14);
	}
</style>
