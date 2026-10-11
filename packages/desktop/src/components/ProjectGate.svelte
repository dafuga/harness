<script lang="ts">
	let { available, busy, open }: { available: boolean; busy: boolean; open: () => void } = $props();
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
</main>
