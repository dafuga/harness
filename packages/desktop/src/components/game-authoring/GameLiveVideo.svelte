<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	let { stream }: { stream?: MediaStream } = $props();
	let video = $state<HTMLVideoElement>();
	let fps = $state<number | null>(null);
	$effect(() => {
		if (!video) return;
		const target = video;
		target.srcObject = stream ?? null;
		fps = null;
		let token = 0,
			active = true,
			started = performance.now(),
			frames = 0;
		function frame(now: number) {
			if (!active) return;
			frames++;
			if (now - started >= 1000) {
				fps = Math.round((frames * 1000) / (now - started));
				frames = 0;
				started = now;
			}
			token = target.requestVideoFrameCallback(frame);
		}
		if (stream && target.requestVideoFrameCallback) token = target.requestVideoFrameCallback(frame);
		return () => {
			active = false;
			if (token) target.cancelVideoFrameCallback(token);
			target.srcObject = null;
		};
	});
</script>

<hx-div>
	<hx-video bind:this={video} autoplay muted playsinline aria-label="AI video"></hx-video>
	<hx-small role="status"
		>AI output: {fps === null ? 'waiting for video frames' : fps + ' fps'}</hx-small
	>
</hx-div>

<style>
	video {
		width: 100%;
		aspect-ratio: 1280/704;
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-large);
		background: var(--hx-color-background);
	}
</style>
