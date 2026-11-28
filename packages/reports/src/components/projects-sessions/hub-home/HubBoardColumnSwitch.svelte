<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_ihssei4kbr -->
<script lang="ts">
	import type { HubBoardColumnSwitchProps } from './hubBoardColumnSwitch.types';

	let { columns, selected, onselect }: HubBoardColumnSwitchProps = $props();

	function needsYou(column: HubBoardColumnSwitchProps['columns'][number]): number {
		return column.needsYou ?? 0;
	}

	function tabLabel(column: HubBoardColumnSwitchProps['columns'][number]): string {
		const count = needsYou(column);
		const base = `${column.label}, ${column.count}`;
		return count > 0 ? `${base}, ${count} need you` : base;
	}

	function keyTarget(key: string, id: HubBoardColumnSwitchProps['selected']) {
		const ids = columns.map((column) => column.id);
		const index = ids.indexOf(id);
		const last = ids.length - 1;
		if (key === 'ArrowRight') return ids[index >= last ? 0 : index + 1];
		if (key === 'ArrowLeft') return ids[index <= 0 ? last : index - 1];
		if (key === 'Home') return ids[0];
		if (key === 'End') return ids[last];
		return undefined;
	}

	function handleKey(event: KeyboardEvent, id: HubBoardColumnSwitchProps['selected']) {
		const target = keyTarget(event.key, id);
		if (target === undefined) return;
		event.preventDefault();
		onselect(target);
		document.getElementById(`hs-tab-${target}`)?.focus();
	}
</script>

<hx-div class="hs-switch" role="tablist" aria-label="Board column">
	{#each columns as column (column.id)}
		<hx-button
			type="button"
			role="tab"
			class="hs-tab"
			id={`hs-tab-${column.id}`}
			aria-selected={column.id === selected}
			tabindex={column.id === selected ? 0 : -1}
			aria-label={tabLabel(column)}
			onclick={() => onselect(column.id)}
			onkeydown={(event: KeyboardEvent) => handleKey(event, column.id)}
		>
			<hx-strong class="hs-count">{column.count}{#if needsYou(column) > 0}<hx-span class="hs-needs-mark" aria-hidden="true"></hx-span>{/if}</hx-strong>
			<hx-span class="hs-label">{column.label}</hx-span>
		</hx-button>
	{/each}
</hx-div>

<style>
	.hs-switch {
		display: grid;
		flex: none;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 4px;
		padding: 4px;
		border-radius: 12px;
		background: var(--hx-color-hover);
	}
	.hs-tab {
		display: flex;
		align-items: center;
		flex-direction: column;
		justify-content: center;
		min-height: 48px;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: var(--hx-color-text-muted);
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		line-height: 16px;
		text-align: center;
	}
	.hs-tab:focus-visible {
		outline: 2px solid var(--home-accent, var(--hx-color-primary));
		outline-offset: 2px;
	}
	.hs-count {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--hx-color-text);
		font-size: 16px;
		line-height: 20px;
		font-weight: 600;
	}
	.hs-needs-mark {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--home-accent, var(--hx-color-primary));
	}
	.hs-tab[aria-selected='true'] {
		border-color: var(--hx-color-border-strong);
		background: var(--hx-color-surface);
		color: var(--hx-color-text);
		font-weight: 600;
	}
</style>
