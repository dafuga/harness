<script lang="ts">
	import BrandMark from '$shared/BrandMark.svelte';
	import type { Snippet } from 'svelte';
	import type { DesktopProject } from '../../models/projects-sessions/ProjectContext.types';
	let {
		available,
		local = true,
		busy,
		open,
		projects = [],
		choose = () => {},
		children
	}: {
		available: boolean;
		/** False on a phone: its projects are those of a computer, and it has no folder to open. */
		local?: boolean;
		busy: boolean;
		open: () => void;
		projects?: DesktopProject[];
		choose?: (projectId: string) => void;
		children?: Snippet;
	} = $props();
	const remote = 'The projects of your computer appear here once this phone is connected.';
	const place = $derived(local ? 'On this device' : 'On your computer');
	const hint = $derived.by(() => {
		if (!local) return projects.length ? 'Choose a project of your computer.' : remote;
		return available
			? 'Choose a local Git project to begin.'
			: 'Browser preview · read-only. Open the desktop app to choose a local project.';
	});
</script>

<main class="project-gate">
	<div class="brand-mark"><BrandMark /></div>
	<h1>Harness</h1>
	<p>Understand your project. Design what comes next.</p>
	{#if local}<button class="primary" disabled={!available || busy} onclick={open}
			>Open Project</button
		>{/if}
	<p class="muted">{hint}</p>
	{#if projects.length}<section class="recent-projects" aria-label="Recent projects">
			<h2>Recent projects</h2>
			{#each projects as item (item.id)}<button
					type="button"
					disabled={busy}
					aria-label={`Open ${item.name}`}
					onclick={() => choose(item.id)}
					><strong>{item.name}</strong><small
						>{item.kind === 'shared' ? 'Shared project' : item.root || place}</small
					></button
				>{/each}
		</section>{/if}{@render children?.()}
</main>
