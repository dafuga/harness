<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import { tooltipPlace } from './tooltipPlace';
	import HarnessIcon from '../HarnessIcon.svelte';
	let {
		passed,
		label,
		reasons = [],
		framed = false
	}: {
		/** True only when every required test, state and commit-bound capture passed. */
		passed: boolean;
		/** A few words for the verdict; it has words of its own without them. */
		label?: string;
		/** Why it did not pass, each in words. */
		reasons?: string[];
		/** An outline around the icon, as on a card. */
		framed?: boolean;
		/** Accepted from earlier callers: the icon alone is what every verdict draws now. */
		bare?: boolean;
	} = $props();
	const id = $props.id();
	// Proven is one value. Missing, stale, unknown and anything else that arrives is not proven.
	let proven = $derived(passed === true);
	let words = $derived(label ?? (proven ? 'Full coverage passed' : 'Verification failed'));
	let unknown = $derived(
		!proven && /missing|stale|incomplete|unknown|not proven|not recorded|no .*recorded/i.test(words)
	);
	let why = $derived(proven ? [] : reasons);
	// What asks for the tooltip: a pointer over the mark or over the tooltip itself, the keyboard
	// on the mark, or a tap that pinned it.
	const nothing = { mark: false, tip: false, focus: false, pinned: false };
	let asked = $state({ ...nothing });
	let open = $derived(asked.mark || asked.tip || asked.focus || asked.pinned);
	let place = $state('');
	let root = $state<HTMLElement>();
	let tip = $state<HTMLElement>();
	const close = () => (asked = { ...nothing });
	const hovered = (event: PointerEvent, part: 'mark' | 'tip', over: boolean) => {
		if (event.pointerType === 'mouse') asked[part] = over;
	};
	// An open tooltip is put inside the screen and follows its mark; it ends when the mark has
	// left the screen, and with a press anywhere else. One with more reasons than the screen has
	// room for is given the room there is, and scrolls inside it.
	function put() {
		if (!root || !tip) return;
		const [at, view] = [root.getBoundingClientRect(), { width: innerWidth, height: innerHeight }];
		if (at.bottom < 0 || at.top > view.height) return close();
		const whole = tip.scrollHeight + tip.offsetHeight - tip.clientHeight;
		const to = tooltipPlace(at, { width: tip.offsetWidth, height: whole }, view);
		const cut = to.height === undefined ? '' : `;max-height:${to.height}px`;
		place = `left:${to.left}px;top:${to.top}px${cut}`;
	}
	// Escape closes it; the keys that scroll a page scroll a tooltip that is longer than its room.
	const steps: Record<string, number> = {
		ArrowDown: 48,
		ArrowUp: -48,
		PageDown: 240,
		PageUp: -240
	};
	function keyed(event: KeyboardEvent) {
		if (event.key === 'Escape') return close();
		const ends = { End: tip?.scrollHeight ?? 0, Home: -(tip?.scrollHeight ?? 0) }[event.key];
		const by = steps[event.key] ?? ends;
		if (by === undefined || !open || !tip || tip.scrollHeight <= tip.clientHeight) return;
		event.preventDefault();
		tip.scrollBy({ top: by });
	}
	$effect(() => {
		if (!open) return void (place = '');
		put();
		const away = (event: Event) => {
			if (!(event.target instanceof Node && root?.contains(event.target))) close();
		};
		window.addEventListener('pointerdown', away, true);
		window.addEventListener('scroll', put, true);
		window.addEventListener('resize', put);
		return () => {
			window.removeEventListener('pointerdown', away, true);
			window.removeEventListener('scroll', put, true);
			window.removeEventListener('resize', put);
		};
	});
</script>

<hx-span
	class="hx-verdict"
	class:passed={proven}
	class:failed={!proven && !unknown}
	class:unknown
	class:framed
	data-harness-component="harness-harness-verdict"
	bind:this={root}
>
	<hx-button
		type="button"
		aria-label={words}
		aria-describedby={id}
		aria-expanded={open}
		onpointerenter={(event) => hovered(event, 'mark', true)}
		onpointerleave={(event) => hovered(event, 'mark', false)}
		onfocus={(event) => (asked.focus = event.currentTarget.matches(':focus-visible'))}
		onblur={close}
		onclick={() => (asked.pinned = !asked.pinned)}
		onkeydown={keyed}
		><HarnessIcon name={proven ? 'passed' : unknown ? 'info' : 'failed'} /></hx-button
	>
	<hx-span
		class="hx-tip"
		role="tooltip"
		{id}
		tabindex="-1"
		hidden={!open}
		style={place || 'visibility:hidden'}
		bind:this={tip}
		onpointerenter={(event) => hovered(event, 'tip', true)}
		onpointerleave={(event) => hovered(event, 'tip', false)}
		><hx-strong>{words}</hx-strong>{#each why as reason, position (position)}<hx-span
				>{reason}</hx-span
			>{/each}</hx-span
	>
</hx-span>

<style>
	/* A verdict is red unless it passed; there is no colour for anything in between. */
	.hx-verdict {
		display: inline-flex;
		align-items: center;
		color: var(--hx-color-error);
		vertical-align: middle;
	}
	.hx-verdict.unknown {
		color: var(--hx-color-text-muted);
	}
	.hx-verdict.passed {
		color: var(--hx-color-success);
	}
	button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 32px;
		min-height: 32px;
		padding: 0;
		border: 0;
		border-radius: var(--hx-radius-pill);
		background: none;
		color: inherit;
		cursor: help;
	}
	/* The mark stays small in a row; what a finger can press around it is larger. */
	button::after {
		content: '';
		position: absolute;
		inset: -6px;
	}
	.framed button {
		min-width: 36px;
		min-height: 36px;
		border: var(--hx-border-thin) solid currentColor;
		border-radius: var(--hx-radius-small);
	}
	/* Placed against the screen, so no column, row or scrolling wrapper cuts it. It scrolls when
	   it is longer than its room, and is no stop of its own for the keyboard: the mark is. */
	.hx-tip {
		position: fixed;
		z-index: var(--hx-layer-popover);
		top: 0;
		left: 0;
		display: grid;
		gap: var(--hx-space-4);
		width: max-content;
		max-width: min(320px, calc(100vw - 16px));
		padding: var(--hx-space-10) var(--hx-space-12);
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		border-radius: var(--hx-radius-small);
		background: var(--hx-color-surface-raised);
		box-shadow: var(--hx-shadow-popover);
		color: var(--hx-color-text-supporting);
		font-size: var(--hx-type-size-sm);
		font-weight: var(--hx-style-weight-regular);
		line-height: var(--hx-style-leading-snug);
		text-align: left;
		white-space: normal;
		overflow-wrap: anywhere;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	.hx-tip[hidden] {
		display: none;
	}
	.hx-tip strong {
		color: var(--hx-color-text);
		font-weight: var(--hx-style-weight-semibold);
	}
	/* The gap to the mark belongs to the tooltip, so a pointer can cross it without closing it. */
	.hx-tip::before {
		content: '';
		position: absolute;
		inset: -9px 0;
		z-index: var(--hx-layer-behind);
	}
</style>
