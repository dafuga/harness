<script lang="ts">
	import type { Region, ThreadInfo } from '../models/Desktop.types';
	let {
		src,
		title,
		threads,
		writable,
		comment,
		select
	}: {
		src: string;
		title: string;
		threads: ThreadInfo[];
		writable: boolean;
		comment: (region: Region | null) => void;
		select: (thread: ThreadInfo) => void;
	} = $props();
	let region = $state<Region | null>(null);
	let selectedRegion = $state<Region | null>(null);
	let start: { x: number; y: number } | null = null;
	let expanded = $state(false);
	$effect(() => {
		if (src) {
			region = null;
			selectedRegion = null;
		}
	});
	let keyboard = $state(false);
	let x = $state(10);
	let y = $state(10);
	let width = $state(40);
	let height = $state(30);
	function point(event: PointerEvent) {
		const bounds = event.currentTarget as HTMLElement;
		const r = bounds.getBoundingClientRect();
		return {
			x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
			y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height))
		};
	}
	function down(event: PointerEvent) {
		if (!writable || (event.target as HTMLElement).closest('button')) return;
		start = point(event);
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		region = null;
	}
	function move(event: PointerEvent) {
		if (!start) return;
		const end = point(event);
		region = {
			x: Math.min(start.x, end.x),
			y: Math.min(start.y, end.y),
			width: Math.abs(end.x - start.x),
			height: Math.abs(end.y - start.y)
		};
	}
	function finish() {
		start = null;
		if (region && (region.width < 0.01 || region.height < 0.01)) region = null;
	}
	function style(r: Region) {
		return `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.width * 100}%;height:${r.height * 100}%`;
	}
	function keyboardComment() {
		comment({
			x: x / 100,
			y: y / 100,
			width: Math.min(width, 100 - x) / 100,
			height: Math.min(height, 100 - y) / 100
		});
		keyboard = false;
	}
</script>

<div class:fullscreen={expanded} class="image-viewer">
	<div class="image-actions">
		<button onclick={() => (expanded = !expanded)}
			>{expanded ? 'Close full size' : 'Open full size ↗'}</button
		><button disabled={!writable} onclick={() => comment(null)}>Comment on image</button><button
			disabled={!writable}
			onclick={() => (keyboard = !keyboard)}>Select region with keyboard</button
		>
	</div>
	<div
		class="image-canvas"
		role="group"
		aria-label="Design image; drag to highlight a region"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={finish}
		onpointercancel={finish}
	>
		<img
			{src}
			alt={title}
			draggable="false"
		/>{#each threads as thread (thread.id)}{#if thread.region}<button
					class="image-pin"
					style={`left:${thread.region.x * 100}%;top:${thread.region.y * 100}%`}
					onclick={() => {
						selectedRegion = thread.region;
						select(thread);
					}}
					aria-label={`Open thread ${thread.pin}`}>{thread.pin}</button
				>{/if}{/each}{#if selectedRegion}<div
				class="image-region"
				style={style(selectedRegion)}
			></div>{/if}
		{#if region}<div class="image-region" style={style(region)}></div>
			<button class="region-comment" onclick={() => comment(region)}>Comment on selection</button
			>{/if}
	</div>
	{#if keyboard}<form
			class="region-form"
			onsubmit={(event) => {
				event.preventDefault();
				keyboardComment();
			}}
		>
			{#each ['x', 'y', 'width', 'height'] as name (name)}<label
					>{name} (%) {#if name === 'x'}<input
							type="number"
							min="0"
							max="99"
							bind:value={x}
						/>{:else if name === 'y'}<input
							type="number"
							min="0"
							max="99"
							bind:value={y}
						/>{:else if name === 'width'}<input
							type="number"
							min="1"
							max="100"
							bind:value={width}
						/>{:else}<input type="number" min="1" max="100" bind:value={height} />{/if}</label
				>{/each}<button class="primary">Comment on region</button>
		</form>{/if}
</div>
