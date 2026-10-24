<!-- @harness-tier molecule -->
<!-- @harness-atoms ../shared-primitives/atoms -->
<script lang="ts">
	import type { HarnessExplanation } from '../../models/explorer-ui/Harness.types';
	import { emittedBytes } from '../../utils/explorer-ui/harnessEmitted';
	import type { EmittedGrowth } from '../../utils/explorer-ui/harnessEmittedGrowth';
	import { signed } from '../../utils/explorer-ui/harnessGrowth';
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

<hx-section class="hc-card hc-panel" aria-label={'Emitted sizes of ' + unit}>
	<hx-h2>Emitted sizes</hx-h2>
	<hx-p class="hc-muted">
		Bytes of what this component is built into, measured from the build of each verified commit.
		Every execution target has a size and a limit of its own; they are never added together.
	</hx-p>
	<hx-div class="hc-table-wrap">
		<hx-table class="hc-table" aria-label={'Emitted sizes of ' + unit}>
			<hx-thead>
				<hx-tr>
					<hx-th>Commit</hx-th>
					{#each growth.targets as target, position (position)}<hx-th>{target.label}</hx-th>{/each}
					<hx-th class="hc-told">Limits and why</hx-th>
				</hx-tr>
			</hx-thead>
			<hx-tbody>
				{#each growth.rows as row, position (position)}
					<hx-tr>
						<hx-td
							>{row.commit.slice(0, 7)}<hx-br /><hx-span class="hc-muted">{row.subject}</hx-span
							></hx-td
						>
						{#each growth.targets as target, position (position)}
							{@const cell = row.cells[target.id]}
							<hx-td>
								{cell.value === undefined ? 'unavailable' : emittedBytes(cell.value)}
								{#if cell.delta}
									<hx-span class={cell.delta > 0 ? 'hc-up' : 'hc-down'}
										>{signed(cell.delta)}</hx-span
									>
								{/if}
								<hx-br /><hx-span class="hc-muted"
									>{cell.limit === undefined
										? cell.unlimited
											? 'not frozen: reviewed as not buildable'
											: 'no limit yet'
										: `limit ${cell.limit}`}</hx-span
								>
								{#if cell.note}<hx-br /><hx-span class="hc-muted">{cell.note}</hx-span>{/if}
							</hx-td>
						{/each}
						<hx-td class="hc-told">
							{#each row.reviews as review, position (position)}
								<hx-div>
									{review.type === 'baseline' ? 'Baseline' : 'Approved'} by {review.reviewer}:
									{review.changes.join(', ')}.
									<hx-span class="hc-muted">{review.reason}</hx-span>
								</hx-div>
							{/each}
							{#if row.changed}
								{#each reasons(row.commit) as reason, position (position)}
									<hx-div>{reason.behavior}</hx-div>
								{/each}
								{#if reasons(row.commit).length === 0}
									<hx-span class="hc-muted">No reason is recorded.</hx-span>
								{/if}
								<hx-button type="button" class="hc-chip" onclick={() => oncompare(row.commit)}
									>Evidence before and after</hx-button
								>
							{/if}
						</hx-td>
					</hx-tr>
				{/each}
			</hx-tbody>
		</hx-table>
	</hx-div>
</hx-section>
