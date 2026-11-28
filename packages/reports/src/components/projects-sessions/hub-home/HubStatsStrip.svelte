<!-- @harness-tier organism -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<!-- @harness-uid u_jeymogffwf -->
<script lang="ts">
	import type { StripComputer } from './hubStripComputers.types';
	import type { StripCounts, StripCount } from './hubStripCounts.types';
	import type { StripQuota } from './hubStripQuota.types';

	let {
		computers,
		quota,
		counts,
		compact = false,
		pressed = null,
		onsessions,
		onneedsyou
	}: {
		computers: StripComputer[];
		quota: StripQuota[];
		counts: StripCounts;
		/** iPhone layout: four number cells, then one chip per computer. */
		compact?: boolean;
		/** The tile whose board filter is on. */
		pressed?: 'sessions' | 'needs-you' | null;
		onsessions?: () => void;
		onneedsyou?: () => void;
	} = $props();

	/** Meter text: the percent, or "unknown" when there is no reading. */
	function valueText(value: number | null): string {
		return value === null ? 'unknown' : `${value}%`;
	}

	/** Desktop quota line: "64% left · resets 21:10", or only the reset text. */
	function quotaSub(entry: StripQuota): string {
		return entry.left === null ? entry.resets : `${entry.left}% left · ${entry.resets}`;
	}
</script>

{#snippet bar(label: string, value: number | null)}
	<hx-div
		class="hs-meter"
		role="meter"
		aria-label={label}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={value ?? undefined}
		aria-valuetext={valueText(value)}
	>
		<hx-span class="hs-fill" style:width={`${value ?? 0}%`}></hx-span>
	</hx-div>
{/snippet}

{#snippet stat(tile: StripCount, key: 'sessions' | 'needs-you', onpress?: () => void)}
	<hx-button
		type="button"
		class="hs-stat"
		class:hs-needs={key === 'needs-you' && tile.value > 0}
		aria-pressed={pressed === key}
		disabled={!onpress}
		onclick={() => onpress?.()}
	>
		<hx-span class="hs-kicker">{tile.label}</hx-span>
		<hx-span class="hs-num">{tile.value}</hx-span>
		<hx-span class="hs-sub">{tile.sub}</hx-span>
	</hx-button>
{/snippet}

<hx-section class="hs-strip" class:hs-compact={compact} aria-label="Overview">
	{#if compact}
		<hx-div class="hs-cells">
			<hx-button type="button" class="hs-cell" aria-pressed={pressed === 'sessions'} disabled={!onsessions} onclick={() => onsessions?.()}>
				<hx-span class="hs-cell-num">{counts.sessions.value}</hx-span>
				<hx-span class="hs-cell-label">Sessions</hx-span>
			</hx-button>
			<hx-button type="button" class="hs-cell" class:hs-needs={counts.needsYou.value > 0} aria-pressed={pressed === 'needs-you'} disabled={!onneedsyou} onclick={() => onneedsyou?.()}>
				<hx-span class="hs-cell-num">{counts.needsYou.value}</hx-span>
				<hx-span class="hs-cell-label">Need you</hx-span>
			</hx-button>
			{#each quota as entry (entry.provider)}
				<hx-div class="hs-cell">
					<hx-span class="hs-cell-num">{entry.left === null ? '–' : `${entry.left}%`}</hx-span>
					<hx-span class="hs-cell-label">{entry.name} left</hx-span>
				</hx-div>
			{/each}
		</hx-div>
		<hx-div class="hs-chips">
			{#each computers as computer (computer.name)}
				<hx-span class="hs-chip" data-tone={computer.tone}>
					<hx-span class="hs-mark" aria-hidden="true"></hx-span>
					<hx-strong class="hs-name">{computer.name}</hx-strong>
					<hx-span class="hs-sub">{computer.short}</hx-span>
				</hx-span>
			{/each}
		</hx-div>
	{:else}
		{@render stat(counts.sessions, 'sessions', onsessions)}
		{@render stat(counts.needsYou, 'needs-you', onneedsyou)}
		<hx-div class="hs-stat">
			<hx-span class="hs-kicker">Computers</hx-span>
			{#if computers.length === 0}
				<hx-span class="hs-sub">No computers linked</hx-span>
			{:else}
				<hx-div class="hs-cols">
					{#each computers as computer (computer.name)}
						<hx-div class="hs-unit" data-tone={computer.tone}>
							<hx-div class="hs-unit-head">
								<hx-span class="hs-mark" aria-hidden="true"></hx-span>
								<hx-span class="hs-name">{computer.name}</hx-span>
								<hx-span class="hs-state">{computer.state}</hx-span>
							</hx-div>
							{@render bar(`${computer.name} load`, computer.load)}
							<hx-span class="hs-sub">{computer.sub}</hx-span>
						</hx-div>
					{/each}
				</hx-div>
			{/if}
		</hx-div>
		<hx-div class="hs-stat">
			<hx-span class="hs-kicker">Quota</hx-span>
			<hx-div class="hs-cols hs-two">
				{#each quota as entry (entry.provider)}
					<hx-div class="hs-unit" data-tone={entry.tone}>
						<hx-div class="hs-unit-head">
							<hx-span class="hs-name">{entry.name}</hx-span>
							<hx-span class="hs-window">{entry.window}</hx-span>
						</hx-div>
						{@render bar(`${entry.name} ${entry.window} left`, entry.left)}
						<hx-span class="hs-sub">{quotaSub(entry)}</hx-span>
					</hx-div>
				{/each}
			</hx-div>
		</hx-div>
	{/if}
</hx-section>

<style>
	.hs-strip { display: flex; flex-direction: column; gap: 8px; color: var(--hx-color-text); }
	.hs-strip:not(.hs-compact) { display: grid; grid-template-columns: 188px 188px minmax(0, 1fr) 360px; gap: 12px; }
	@media (max-width: 899px) { .hs-strip:not(.hs-compact) { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	.hs-stat { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 14px 16px; border: 1px solid var(--hx-color-border); border-radius: 10px; background: var(--hx-color-surface); color: inherit; font: inherit; text-align: left; }
	.hs-stat[type='button'], .hs-cell[type='button'] { cursor: pointer; }
	.hs-stat[type='button']:disabled, .hs-cell[type='button']:disabled { cursor: default; }
	.hs-stat:focus-visible, .hs-cell:focus-visible { outline: 2px solid var(--hx-color-primary); outline-offset: 2px; }
	.hs-stat.hs-needs, .hs-cell.hs-needs { border-color: var(--hx-color-primary-line); background: linear-gradient(var(--hx-color-primary-wash), var(--hx-color-primary-wash)), var(--hx-color-surface); }
	.hs-needs .hs-kicker, .hs-needs .hs-num, .hs-needs .hs-cell-num, .hs-needs .hs-cell-label { color: var(--hx-color-primary); }
	.hs-stat[aria-pressed='true'], .hs-cell[aria-pressed='true'] { border-color: var(--hx-color-primary); background: var(--hx-color-primary-soft); }
	.hs-kicker { color: var(--hx-color-text-muted); font-size: 11px; line-height: 16px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
	.hs-num { font-size: 30px; line-height: 36px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
	.hs-sub { color: var(--hx-color-text-muted); font-size: 13px; line-height: 20px; }
	.hs-window { color: var(--hx-color-text-muted); font-size: 12px; line-height: 16px; }
	.hs-cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; margin-top: 6px; }
	.hs-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.hs-unit { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
	.hs-unit .hs-sub { font-size: 12px; line-height: 16px; }
	.hs-unit-head { display: flex; align-items: center; gap: 8px; font-weight: 600; line-height: 20px; }
	.hs-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
	.hs-state { margin-left: auto; color: var(--tone); font-size: 12px; }
	.hs-mark { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--tone); }
	.hs-meter { height: 6px; border-radius: 3px; background: var(--hx-color-surface-raised); overflow: hidden; }
	.hs-fill { display: block; height: 100%; border-radius: 3px; background: var(--tone, var(--hx-color-info)); }
	.hs-cells { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid var(--hx-color-border); border-radius: 10px; background: var(--hx-color-surface); overflow: hidden; }
	.hs-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; min-height: 60px; padding: 8px 4px 8px 12px; border: 0; border-left: 1px solid var(--hx-color-border); background: transparent; color: inherit; font: inherit; text-align: left; }
	.hs-cell:first-child { border-left: 0; }
	.hs-cell-num { font-size: 20px; line-height: 24px; font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
	.hs-cell-label { color: var(--hx-color-text-muted); font-size: 11px; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.hs-chips { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
	.hs-chip { display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: 8px; align-items: center; min-width: 0; min-height: 44px; padding: 4px 10px; border: 1px solid var(--hx-color-border); border-radius: 10px; background: var(--hx-color-surface); font-size: 12px; line-height: 16px; }
	.hs-chip .hs-mark { grid-row: 1 / span 2; }
	.hs-chip .hs-name, .hs-chip .hs-sub { grid-column: 2; min-width: 0; }
	.hs-chip .hs-sub { font-size: 12px; line-height: 16px; }
	[data-tone='done'] { --tone: var(--hx-color-success); }
	[data-tone='active'] { --tone: var(--hx-color-info); }
	[data-tone='warn'] { --tone: var(--hx-color-warning); }
	[data-tone='blocked'] { --tone: var(--hx-color-error); }
</style>
