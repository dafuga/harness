<script lang="ts">
	import type { ExplorerEntity } from '../../models/Explorer.types';
	import { catalogShot } from '../../utils/entityScreens';
	import { entityLens, shortCommit, type EntityLens, type EntityNav } from '../../utils/entityLens';
	import { tooltipPlace } from '../../utils/tooltipPlace';
	import EntityLink from './EntityLink.svelte';
	let {
		entity,
		nav,
		lens,
		mediaBase
	}: { entity: ExplorerEntity; nav: EntityNav; lens: EntityLens; mediaBase: string } = $props();
	const id = $props.id();
	let to = $derived(
		entityLens(nav.route, {
			category: entity.category,
			entity: entity.id,
			helper: entity.caller?.symbol
		})
	);
	// A pointer over the link or its preview, or the keyboard on the link, opens it; a touch never
	// does, so a tap follows the link at once.
	let over = $state(false);
	let focused = $state(false);
	let open = $derived(over || focused);
	// This consumer's own capture at the shown revision, read only while open; never another's.
	let visual = $derived(['pages', 'layouts', 'components'].includes(entity.category));
	let shot = $derived(
		open && visual ? catalogShot(lens.evidence(entity.unit), entity.unit.preview, true) : null
	);
	let file = $derived(shot && !shot.missing ? shot.file : '');
	let failed = $state('');
	let pictured = $derived(Boolean(file) && failed !== file);
	let taken = $derived(shot?.standing === 'Fresh capture' ? 'Fresh capture at' : 'Reused from');
	let origin = $derived(`${taken} ${shortCommit(shot?.source ?? '')}`);
	let root = $state<HTMLElement>();
	let tip = $state<HTMLElement>();
	let place = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;
	// Escape, a press elsewhere and a blur end it; only a new hover or focus opens it again.
	function close() {
		clearTimeout(timer);
		over = false;
		focused = false;
		failed = '';
	}
	function enter(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		clearTimeout(timer);
		over = true;
	}
	// Leaving waits a moment, so a pointer can cross the gap between the link and its preview.
	function leave(event: PointerEvent) {
		if (event.pointerType === 'touch') return;
		clearTimeout(timer);
		timer = setTimeout(() => (over = false), 150);
	}
	// Placed against the screen, so no card or scrolling table cuts it; it ends once its link has
	// left the screen.
	function put() {
		if (!root || !tip) return;
		const at = root.getBoundingClientRect();
		const view = { width: document.documentElement.clientWidth, height: innerHeight };
		if (at.bottom < 0 || at.top > view.height) return close();
		const whole = tip.scrollHeight + tip.offsetHeight - tip.clientHeight;
		const spot = tooltipPlace(at, { width: tip.offsetWidth, height: whole }, view);
		const cut = spot.height === undefined ? '' : `;max-height:${spot.height}px`;
		place = `left:${spot.left}px;top:${spot.top}px${cut}`;
	}
	// A file that loads but cannot be decoded is no picture either.
	function loaded(image: EventTarget & Element) {
		if (image instanceof HTMLImageElement && image.naturalWidth) put();
		else failed = file;
	}
	$effect(() => {
		if (!open) return void (place = '');
		// A picture that turns into its gap changes the size, so it is placed again.
		void pictured;
		put();
		const away = (event: Event) => {
			if (!(event.target instanceof Node && root?.contains(event.target))) close();
		};
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close();
		};
		window.addEventListener('pointerdown', away, true);
		window.addEventListener('keydown', escape);
		window.addEventListener('scroll', put, true);
		window.addEventListener('resize', put);
		return () => {
			window.removeEventListener('pointerdown', away, true);
			window.removeEventListener('keydown', escape);
			window.removeEventListener('scroll', put, true);
			window.removeEventListener('resize', put);
		};
	});
	$effect(() => () => clearTimeout(timer));
</script>

<span class="ex-usage-link" bind:this={root}
	>{#if entity.caller?.sourceOnly}
		<button
			type="button"
			disabled={!nav.source}
			onclick={(event) =>
				nav.source?.(entity, `${entity.name} — ${entity.unit.title}`, event.currentTarget)}
			>{entity.name}</button
		>
	{:else}<EntityLink
			{to}
			{nav}
			aria-describedby={open ? id : undefined}
			onpointerenter={enter}
			onpointerleave={leave}
			onfocus={(event) => (focused = event.currentTarget.matches(':focus-visible'))}
			onblur={close}>{entity.name}</EntityLink
		>{#if open}<span
				class="ex-usage-preview"
				role="tooltip"
				{id}
				aria-label={`Preview of ${entity.name}`}
				style={place || 'visibility:hidden'}
				bind:this={tip}
				onpointerenter={enter}
				onpointerleave={leave}
			>
				{#if !visual}
					<code>{entity.caller?.symbol ?? entity.unit.title}</code><span>{entity.role}</span>
				{:else if pictured && shot}
					<img
						src={mediaBase + file}
						alt={`Screenshot of ${entity.name}`}
						decoding="async"
						onload={(event) => loaded(event.currentTarget)}
						onerror={() => (failed = file)}
					/>
					<span>{origin}</span>
				{:else}
					<span>No screenshot is recorded at this revision</span>
				{/if}
			</span>{/if}{/if}</span
>

<style>
	.ex-usage-link {
		min-width: 0;
		max-width: 100%;
	}
	.ex-usage-link > :global(a),
	.ex-usage-link > button {
		color: var(--ex-soft);
		overflow-wrap: break-word;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.ex-usage-link > button {
		background: none;
		border: 0;
		padding: 0;
		font: inherit;
		cursor: pointer;
		text-align: left;
	}
	.ex-usage-link > :global(a:hover) {
		color: var(--ex-text);
	}
	.ex-usage-preview {
		position: fixed;
		z-index: var(--hx-layer-popover);
		top: 0;
		left: 0;
		display: grid;
		gap: var(--hx-space-6);
		width: min(280px, calc(100vw - 16px));
		padding: var(--hx-space-8);
		border: var(--hx-border-thin) solid var(--ex-line-strong);
		border-radius: var(--hx-radius-small);
		background: var(--ex-raised);
		box-shadow: var(--hx-shadow-popover);
		color: var(--ex-soft);
		font-size: var(--hx-type-size-compact);
		font-weight: var(--hx-style-weight-regular);
		line-height: var(--hx-style-leading-snug);
		text-align: left;
		white-space: normal;
		overflow-wrap: anywhere;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
	/* The whole capture, never cut, at one size whether or not it has loaded yet. */
	.ex-usage-preview img {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 10;
		object-fit: contain;
		border-radius: var(--hx-radius-xsmall);
		background: var(--ex-surface);
	}
</style>
