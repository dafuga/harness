<script lang="ts">
	import type { Mark } from './DeploymentProgress.types';

	import type { DeploymentActivity } from '../../models/development-tooling/Deployment.types';
	/**
	 * Where one deployment is: its live line and why it failed, if it did, then its steps. The steps
	 * before the current one are done; the current one runs, or is where it failed. A queued
	 * deployment has no current step yet and a complete one has every step done. Each state is said
	 * in words as well as drawn.
	 */
	let { deployment }: { deployment: DeploymentActivity } = $props();
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
		gap: var(--hx-space-8);
	}
	/* The live line, and any failure under it, take the colour of how the deployment stands; their
	   words say the same. */
	.now {
		display: grid;
		gap: var(--hx-space-2);
		padding: var(--hx-space-8) var(--hx-space-12);
		border-inline-start: var(--hx-border-heavy) solid;
		border-radius: var(--hx-radius-xsmall);
		background: var(--hx-color-primary-wash);
		color: var(--hx-color-primary);
	}
	[data-phase='queued'] .now {
		background: var(--hx-color-hover);
		color: var(--hx-color-text-muted);
	}
	[data-phase='complete'] .now {
		background: var(--hx-color-success-soft);
		color: var(--hx-color-success);
	}
	[data-phase='failed'] .now {
		background: var(--hx-color-error-soft);
		color: var(--hx-color-error);
	}
	p {
		margin: 0;
		font-size: var(--hx-type-size-compact);
		font-weight: var(--hx-style-weight-semibold);
		line-height: var(--hx-style-leading-normal);
		overflow-wrap: anywhere;
	}
	.failure {
		font-size: var(--hx-type-size-xs);
		font-weight: var(--hx-style-weight-regular);
		color: var(--hx-color-error);
	}
	ol {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--hx-type-size-compact);
	}
	/* One rail joins the steps, filled through those done; the current step is lit on its row. */
	li {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--hx-space-10);
		min-height: 30px;
		padding-inline: var(--hx-space-8);
		border-radius: var(--hx-radius-compact);
		color: var(--hx-color-text-muted);
	}
	li:not(:last-child)::after {
		content: '';
		position: absolute;
		top: calc(50% + 10px);
		bottom: calc(10px - 50%);
		left: 15px;
		width: 2px;
		border-radius: var(--hx-radius-hairline);
		background: var(--hx-color-border);
	}
	li.done::after {
		background: var(--hx-color-success-line);
	}
	li.done,
	li[aria-current='step'] {
		color: var(--hx-color-text);
	}
	li[aria-current='step'] {
		background: var(--hx-color-primary-wash);
		font-weight: var(--hx-style-weight-semibold);
	}
	li.failed {
		background: var(--hx-color-error-soft);
	}
	/* A shape for each state, so none is told by its colour alone: ring, dot, tick and cross. */
	.marker {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 16px;
		height: 16px;
		border: var(--hx-border-medium) solid var(--hx-color-border-strong);
		border-radius: var(--hx-radius-round);
		font-size: var(--hx-type-size-2xs);
		line-height: var(--hx-style-leading-none);
	}
	.running .marker {
		border-color: var(--hx-color-primary);
	}
	.running .marker::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: var(--hx-radius-round);
		background: var(--hx-color-primary);
	}
	.done .marker {
		border-color: var(--hx-color-success);
		background: var(--hx-color-success-soft);
		color: var(--hx-color-success);
	}
	.done .marker::before {
		content: '✓';
	}
	.failed .marker {
		border-color: var(--hx-color-error);
		color: var(--hx-color-error);
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
