<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DesktopProject } from '../models/ProjectContext.types';
	let {
		available,
		busy,
		open,
		projects = [],
		choose = () => {},
		children
	}: {
		available: boolean;
		busy: boolean;
		open: () => void;
		projects?: DesktopProject[];
		choose?: (projectId: string) => void;
		children?: Snippet;
	} = $props();
</script>

<main class="project-gate">
	<div class="brand-mark">◈</div>
	<h1>Harness</h1>
	<p>Understand your project. Design what comes next.</p>
	<button class="primary" disabled={!available || busy} onclick={open}>Open Project</button>
	<p class="muted">
		{available
			? 'Choose a local Git project to begin.'
			: 'Browser preview · read-only. Open the desktop app to choose a local project.'}
	</p>
	{#if projects.length}<section class="recent-projects" aria-label="Recent projects">
			<h2>Recent projects</h2>
			{#each projects as item (item.id)}<button
					type="button"
					disabled={busy}
					aria-label={`Open ${item.name}`}
					onclick={() => choose(item.id)}
					><strong>{item.name}</strong><small
						>{item.kind === 'shared' ? 'Shared project' : item.root || 'On this device'}</small
					></button
				>{/each}
		</section>{/if}{@render children?.()}
</main>
