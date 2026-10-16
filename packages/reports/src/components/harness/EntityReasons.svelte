<script lang="ts">
	import { reasonUses, type EntityReasons } from '../../utils/entityReasons';
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
	<details class="ex-full" {id} bind:open>
		<summary
			>Full reasons <span class="ex-soft"
				>{some(reasons.notes.length, 'note')}, {some(reasons.attempted.length, 'attempt')}</span
			></summary
		>
		<section aria-label="What changed, as written">
			<p class="ex-eyebrow">What changed</p>
			<ul>
				{#each reasons.notes as note, position (position)}
					<li>
						<p>{note.behavior}</p>
						<p class="ex-soft">{note.subjects.join(', ')}</p>
					</li>
				{/each}
			</ul>
		</section>
		<section aria-label="What was tried, as written">
			<p class="ex-eyebrow">What was tried</p>
			<ul>
				{#each reasons.attempted as tried, position (position)}
					<li>
						<p>{tried.attempt}</p>
						{#each reasonUses(tried.uses) as use}
							<p class="ex-soft">
								<strong>{use.kind}, {use.outcome}</strong> · {use.subjects.join(', ')}
							</p>
						{/each}
					</li>
				{/each}
			</ul>
		</section>
	</details>
{/if}
