<script lang="ts" generics="View extends string">
	import { plainClick, type HarnessTab } from '../../utils/harnessShell';
	let {
		view,
		onview,
		tabs,
		label = 'Views'
	}: {
		view: View;
		onview: (view: View) => void;
		/** The tabs of an entity; without a list the row is the views the console had. */
		tabs?: Array<HarnessTab<View>>;
		label?: string;
	} = $props();
	const views = [
		{ id: 'map', label: 'Component map' },
		{ id: 'compare', label: 'Compare' },
		{ id: 'history', label: 'History' },
		{ id: 'growth', label: 'Growth' },
		{ id: 'activity', label: 'Activity' }
	] as Array<HarnessTab<View>>;
	// A tab with an address is a link; a plain click on it stays in the application.
	function follow(event: MouseEvent, id: View) {
		if (!plainClick(event)) return;
		event.preventDefault();
		onview(id);
	}
	let strip = $state<HTMLElement>();
	// A strip narrower than its tabs scrolls sideways. The tab that is shown is brought wholly
	// into it, by moving the strip alone: the page is not scrolled, and nothing is focused.
	function reveal() {
		const shown = strip?.querySelector('[aria-selected="true"]');
		if (!strip || !shown) return;
		const [held, own] = [strip.getBoundingClientRect(), shown.getBoundingClientRect()];
		if (own.left < held.left) strip.scrollLeft -= held.left - own.left;
		else if (own.right > held.right) strip.scrollLeft += own.right - held.right;
	}
	// It is brought into view when another tab is shown, and whenever the strip changes its width.
	$effect(() => {
		void [view, tabs];
		reveal();
	});
	$effect(() => {
		if (!strip) return;
		const resized = new ResizeObserver(reveal);
		resized.observe(strip);
		return () => resized.disconnect();
	});
</script>

<div class={tabs ? 'hx-tabs' : 'hc-tabs'} role="tablist" aria-label={label} bind:this={strip}>
	{#each tabs ?? views as item (item.id)}
		{#if item.href && !item.disabled}
			<a
				role="tab"
				href={item.href}
				aria-selected={view === item.id}
				onclick={(event) => follow(event, item.id)}>{item.label}</a
			>
		{:else}
			<button
				type="button"
				role="tab"
				aria-selected={view === item.id}
				disabled={item.disabled}
				onclick={() => onview(item.id)}>{item.label}</button
			>
		{/if}
	{/each}
</div>
