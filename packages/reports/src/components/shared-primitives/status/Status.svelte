<!-- @harness-tier organism -->
<!-- @harness-atoms ../atoms -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '../../../utils/reports-media/reportLocale';
	import type { Status as ReportStatus } from '../../../models/reports-media/Report.types';
	import { tooltipPlace } from './tooltipPlace';
	import HarnessIcon from '../../explorer-ui/HarnessIcon.svelte';
	let {
		passed = false,
		variant = 'verdict',
		status = 'unknown',
		reason = '',
		active = false,
		cancel,
		children,
		label,
		reasons = [],
		framed = false
	}: {
		/** True only when every required test, state and commit-bound capture passed. */
		passed?: boolean;
		/** Optional rendering mode; defaults to verdict, retaining each existing visual treatment. */
		variant?: 'verdict' | 'icon' | 'badge' | 'run';
		/** Optional icon or badge status. Defaults to unknown; only verified passes in icon mode. */
		status?: string;
		/** Optional icon explanation; empty defaults to No verification recorded for this revision. */
		reason?: string;
		/** Optional run activity flag. Defaults to false, omitting Cancel run. */
		active?: boolean;
		/** Optional cancellation callback; defaults to undefined and is never invoked without a click. */
		cancel?: () => void;
		/** Optional run content slot; defaults to the run label. Slot errors propagate. */
		children?: Snippet;
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
	let iconOpen = $state(false);
	const description = $derived(reason || 'No verification recorded for this revision.');
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
		const mark = root?.querySelector('button');
		if (!mark || !tip) return;
		const [at, view] = [mark.getBoundingClientRect(), { width: innerWidth, height: innerHeight }];
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

{#if variant === 'badge'}
	<hx-span class="badge {status}"
		><hx-span aria-hidden="true">●</hx-span> {$t(status as ReportStatus)}</hx-span
	>
{:else if variant === 'icon'}
	<hx-span class="verification-wrap"
		><hx-button
			class="verification"
			class:passed={status === 'verified'}
			aria-label={description}
			title={description}
			onclick={() => (iconOpen = true)}
			onblur={() => (iconOpen = false)}
			onfocus={() => (iconOpen = true)}
			onmouseenter={() => (iconOpen = true)}
			onmouseleave={() => (iconOpen = false)}>{status === 'verified' ? '✓' : '×'}</hx-button
		>{#if iconOpen}<hx-span class="reason" role="status">{description}</hx-span>{/if}</hx-span
	>
{:else if variant === 'run'}
	{#if label}<hx-div class="run-status" role="status"
			><hx-span
				>{#if children}{@render children()}{:else}{label}{/if}</hx-span
			>{#if active}<hx-button onclick={cancel}>Cancel run</hx-button>{/if}</hx-div
		>{/if}
{:else}
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
{/if}

<style>
	@import './status.css';
</style>
