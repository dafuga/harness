<script lang="ts">
	import type { DeploymentActivity } from '../../models/development-tooling/Deployment.types';
	/**
	 * Where one deployment is: its live line and why it failed, if it did, then its steps. The steps
	 * before the current one are done; the current one runs, or is where it failed. A queued
	 * deployment has no current step yet and a complete one has every step done. Each state is said
	 * in words as well as drawn.
	 */
	let { deployment }: { deployment: DeploymentActivity } = $props();
	type Mark = 'done' | 'running' | 'failed' | 'waiting';
	const words: Record<Mark, string> = {
		done: 'done',
		running: 'in progress',
		failed: 'failed',
		waiting: 'not started'
	};
	const current = $derived(
		deployment.phase === 'queued' || deployment.phase === 'complete'
			? -1
			: deployment.steps.findIndex((step) => step.id === deployment.step)
	);
	function mark(index: number): Mark {
		if (deployment.phase === 'complete') return 'done';
		if (current < 0 || index > current) return 'waiting';
		if (index < current) return 'done';
		return deployment.phase === 'failed' ? 'failed' : 'running';
	}
</script>

<div class="deployment-progress" data-phase={deployment.phase}>
	<div class="now">
		<p role="status" aria-live="polite">{deployment.detail}</p>
		{#if deployment.error}<p class="failure" role="alert">{deployment.error}</p>{/if}
	</div>
	<ol aria-label="Deployment steps">
		{#each deployment.steps as step, index (step.id)}{@const kind = mark(index)}
			<li class={kind} aria-current={index === current ? 'step' : undefined}>
				<span class="marker" aria-hidden="true"></span>{step.title}<span class="said"
					>, {words[kind]}</span
				>
			</li>{/each}
	</ol>
</div>

<style>
	.deployment-progress {
		display: grid;
		gap: 8px;
	}
	/* The live line, and any failure under it, take the colour of how the deployment stands; their
	   words say the same. */
	.now {
		display: grid;
		gap: 2px;
		padding: 8px 12px;
		border-inline-start: 3px solid;
		border-radius: 4px;
		background: rgb(255 208 53 / 0.07);
		color: var(--gold);
	}
	[data-phase='queued'] .now {
		background: rgb(165 189 208 / 0.07);
		color: var(--muted);
	}
	[data-phase='complete'] .now {
		background: rgb(127 227 192 / 0.07);
		color: #7fe3c0;
	}
	[data-phase='failed'] .now {
		background: rgb(255 171 176 / 0.08);
		color: #ffabb0;
	}
	p {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}
	.failure {
		font-size: 12px;
		font-weight: 400;
		color: #ffd6d9;
	}
	ol {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 13px;
	}
	/* One rail joins the steps, filled through those done; the current step is lit on its row. */
	li {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 30px;
		padding-inline: 8px;
		border-radius: 6px;
		color: var(--muted);
	}
	li:not(:last-child)::after {
		content: '';
		position: absolute;
		top: calc(50% + 10px);
		bottom: calc(10px - 50%);
		left: 15px;
		width: 2px;
		border-radius: 1px;
		background: var(--line);
	}
	li.done::after {
		background: rgb(127 227 192 / 0.45);
	}
	li.done,
	li[aria-current='step'] {
		color: #edf4fa;
	}
	li[aria-current='step'] {
		background: rgb(255 208 53 / 0.08);
		font-weight: 600;
	}
	li.failed {
		background: rgb(255 171 176 / 0.09);
	}
	/* A shape for each state, so none is told by its colour alone: ring, dot, tick and cross. */
	.marker {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 16px;
		height: 16px;
		border: 1.5px solid #3d6479;
		border-radius: 50%;
		font-size: 10px;
		line-height: 1;
	}
	.running .marker {
		border-color: var(--gold);
	}
	.running .marker::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--gold);
	}
	.done .marker {
		border-color: #7fe3c0;
		background: rgb(127 227 192 / 0.12);
		color: #7fe3c0;
	}
	.done .marker::before {
		content: '✓';
	}
	.failed .marker {
		border-color: #ffabb0;
		color: #ffabb0;
	}
	.failed .marker::before {
		content: '✕';
	}
	.said {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
