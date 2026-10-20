<script lang="ts">
	import type { DeploymentActivity } from '../models/Deployment.types';
	/**
	 * Where one deployment is: its live line, then its steps. The steps before the current one are
	 * done; the current one runs, or is where it failed. A queued deployment has no current step yet
	 * and a complete one has every step done. Each state is said in words as well as drawn.
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
	<p role="status" aria-live="polite">{deployment.detail}</p>
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
		gap: 10px;
	}
	/* The live line takes the colour of how the deployment stands; its words say the same. */
	p {
		margin: 0;
		font-size: 13px;
		color: var(--gold);
		overflow-wrap: anywhere;
	}
	[data-phase='queued'] p {
		color: var(--muted);
	}
	[data-phase='complete'] p {
		color: #7fe3c0;
	}
	[data-phase='failed'] p {
		color: #ffabb0;
	}
	ol {
		display: grid;
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 13px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
	}
	li.done,
	li[aria-current='step'] {
		color: inherit;
	}
	li[aria-current='step'] {
		font-weight: 600;
	}
	/* A shape for each state, so none is told by its colour alone: ring, dot, tick and cross. */
	.marker {
		display: inline-grid;
		place-items: center;
		flex: none;
		width: 16px;
		height: 16px;
		border: 1.5px solid var(--line);
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
