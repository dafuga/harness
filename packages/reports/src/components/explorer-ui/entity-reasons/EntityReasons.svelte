<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../shared-primitives/atoms -->
<script lang="ts">
	import { reasonUses } from './entityReasons';
	import { type EntityReasons } from '../../../utils/explorer-ui/entityReasons';
	let {
		reasons,
		open = $bindable(false),
		id
	}: {
		/** The reasons one commit recorded for an entity: their summary and what was written. */
		reasons: EntityReasons;
		/** Whether what was written is shown in full. */
		open?: boolean;
		id?: string;
	} = $props();
	const some = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`;
</script>

<!-- A summary that says everything needs nothing beside it. -->
{#if reasons.long}
	<!-- The marker draws no box: the disclosure stays where its row or cell places it. -->
	<hx-div class="ex-reasons-piece" data-harness-component="harness-entity-reasons">
		<hx-details class="ex-full" {id} bind:open>
			<hx-summary
				>Full reasons <hx-span class="ex-soft"
					>{some(reasons.notes.length, 'note')}, {some(
						reasons.attempted.length,
						'attempt'
					)}</hx-span
				></hx-summary
			>
			<hx-section aria-label="What changed, as written">
				<hx-p class="ex-eyebrow">What changed</hx-p>
				<hx-ul>
					{#each reasons.notes as note, position (position)}
						<hx-li>
							<hx-p>{note.behavior}</hx-p>
							<hx-p class="ex-soft">{note.subjects.join(', ')}</hx-p>
						</hx-li>
					{/each}
				</hx-ul>
			</hx-section>
			<hx-section aria-label="What was tried, as written">
				<hx-p class="ex-eyebrow">What was tried</hx-p>
				<hx-ul>
					{#each reasons.attempted as tried, position (position)}
						<hx-li>
							<hx-p>{tried.attempt}</hx-p>
							{#each reasonUses(tried.uses) as use}
								<hx-p class="ex-soft">
									<hx-strong>{use.kind}, {use.outcome}</hx-strong> · {use.subjects.join(', ')}
								</hx-p>
							{/each}
						</hx-li>
					{/each}
				</hx-ul>
			</hx-section>
		</hx-details>
	</hx-div>
{/if}

<style>
	.ex-reasons-piece {
		display: contents;
	}
</style>
