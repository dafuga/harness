<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<!-- @harness-uid u_7465g3sdj3 -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	/**
	 * The shared list of choices inside a picker popover: rows, not a native list box. Arrow keys,
	 * Home and End move focus between the enabled rows; Enter or Space on a row chooses it.
	 */
	let { label, title, children }: { label: string; title?: string; children: Snippet } = $props();
	const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
	/** Listens on the group itself, so a filter field above the rows can hand focus down too. */
	function arrows(group: HTMLElement) {
		group.addEventListener('keydown', move);
		return { destroy: () => group.removeEventListener('keydown', move) };
	}
	function move(event: KeyboardEvent) {
		if (!keys.includes(event.key)) return;
		// In the filter field only the arrows leave it; Home and End keep moving its caret.
		if (event.target instanceof HTMLInputElement && !event.key.startsWith('Arrow')) return;
		const group = event.currentTarget as HTMLElement;
		const rows = [...group.querySelectorAll<HTMLElement>('.choice-row:enabled')];
		if (rows.length === 0) return;
		const at = rows.indexOf(document.activeElement as HTMLElement);
		const last = rows.length - 1;
		const next =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? last
					: event.key === 'ArrowDown'
						? Math.min(last, at + 1)
						: Math.max(0, at - 1);
		event.preventDefault();
		rows[next]?.focus();
	}
</script>

<hx-div class="choice-rows" role="group" aria-label={label} use:arrows>
	{#if title}<hx-small class="choice-title">{title}</hx-small>{/if}
	{@render children()}
</hx-div>

<style>
	.choice-rows {
		display: grid;
		min-width: 0;
	}
	.choice-title {
		padding: var(--hx-space-10) var(--hx-space-6) var(--hx-space-4);
		color: var(--hx-color-text-muted);
	}
</style>
