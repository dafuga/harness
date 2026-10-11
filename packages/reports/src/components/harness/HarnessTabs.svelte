<script lang="ts">
	import type { ConsoleView } from '../../../../../src/utils/consoleRoute';
	let { view, onview }: { view: ConsoleView; onview: (view: ConsoleView) => void } = $props();
	const views: Array<[ConsoleView, string]> = [
		['map', 'Component map'],
		['compare', 'Compare'],
		['history', 'History'],
		['growth', 'Growth'],
		['activity', 'Activity']
	];
</script>

<div class="hc-tabs" role="tablist" aria-label="Views">
	{#each views as [id, title] (id)}
		<button type="button" role="tab" aria-selected={view === id} onclick={() => onview(id)}
			>{title}</button
		>
	{/each}
</div>
