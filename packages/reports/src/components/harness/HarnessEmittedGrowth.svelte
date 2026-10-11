<script lang="ts">
	import type { HarnessExplanation } from '../../models/Harness.types';
	import { emittedBytes } from '../../utils/harnessEmitted';
	import type { EmittedGrowth } from '../../utils/harnessEmittedGrowth';
	import { signed } from '../../utils/harnessGrowth';
	let {
		unit,
		growth,
		reasons,
		oncompare
	}: {
		unit: string;
		growth: EmittedGrowth;
		/** The recorded reasons of this unit at a commit, once they are loaded. */
		reasons: (commit: string) => HarnessExplanation[];
		/** Opens the comparison of a commit with the one before it, where its evidence is. */
		oncompare: (commit: string) => void;
	} = $props();
</script>

<section class="hc-card hc-panel" aria-label={'Emitted sizes of ' + unit}>
	<h2>Emitted sizes</h2>
	<p class="hc-muted">
		Bytes of what this component is built into, measured from the build of each verified commit.
		Every execution target has a size and a limit of its own; they are never added together.
	</p>
	<div class="hc-table-wrap">
		<table class="hc-table" aria-label={'Emitted sizes of ' + unit}>
			<thead>
				<tr>
					<th>Commit</th>
					{#each growth.targets as target, position (position)}<th>{target.label}</th>{/each}
					<th class="hc-told">Limits and why</th>
				</tr>
			</thead>
			<tbody>
				{#each growth.rows as row, position (position)}
					<tr>
						<td>{row.commit.slice(0, 7)}<br /><span class="hc-muted">{row.subject}</span></td>
						{#each growth.targets as target, position (position)}
							{@const cell = row.cells[target.id]}
							<td>
								{cell.value === undefined ? 'unavailable' : emittedBytes(cell.value)}
								{#if cell.delta}
									<span class={cell.delta > 0 ? 'hc-up' : 'hc-down'}>{signed(cell.delta)}</span>
								{/if}
								<br /><span class="hc-muted"
									>{cell.limit === undefined
										? cell.unlimited
											? 'not frozen: reviewed as not buildable'
											: 'no limit yet'
										: `limit ${cell.limit}`}</span
								>
								{#if cell.note}<br /><span class="hc-muted">{cell.note}</span>{/if}
							</td>
						{/each}
						<td class="hc-told">
							{#each row.reviews as review, position (position)}
								<div>
									{review.type === 'baseline' ? 'Baseline' : 'Approved'} by {review.reviewer}:
									{review.changes.join(', ')}.
									<span class="hc-muted">{review.reason}</span>
								</div>
							{/each}
							{#if row.changed}
								{#each reasons(row.commit) as reason, position (position)}
									<div>{reason.behavior}</div>
								{/each}
								{#if reasons(row.commit).length === 0}
									<span class="hc-muted">No reason is recorded.</span>
								{/if}
								<button type="button" class="hc-chip" onclick={() => oncompare(row.commit)}
									>Evidence before and after</button
								>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>
