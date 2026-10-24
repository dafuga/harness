<!-- @harness-tier organism -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import type { MechanicDefinition } from '../../../../game/src/index';
	import GameTextField from './GameTextField.svelte';
	let {
		mechanics,
		change,
		readonly = false
	}: {
		mechanics: MechanicDefinition[];
		change: (list: MechanicDefinition[]) => void;
		readonly?: boolean;
	} = $props();

	/** Comma or line separated names; blanks are dropped. Read on change so commas can be typed. */
	function names(text: string): string[] {
		return text
			.split(/[,\n]/)
			.map((name) => name.trim())
			.filter(Boolean);
	}
	function update(index: number, patch: Partial<MechanicDefinition>) {
		if (readonly) return;
		change(mechanics.map((item, at) => (at === index ? { ...item, ...patch } : item)));
	}
	function add() {
		if (readonly) return;
		const taken = new Set(mechanics.map((item) => item.id));
		let n = mechanics.length + 1;
		while (taken.has('mechanic-' + n)) n++;
		change([
			...mechanics,
			{ id: 'mechanic-' + n, title: 'New mechanic', description: '', inputs: [], events: [] }
		]);
	}
	function remove(index: number) {
		if (!readonly) change(mechanics.filter((_, at) => at !== index));
	}
</script>

<hx-section class="mechanics" data-harness-component="game-mechanics">
	<hx-header>
		<hx-div>
			<hx-h2>Mechanics</hx-h2>
			<hx-p>Rules the game follows in every view. Editing them never changes the checkpoints.</hx-p>
		</hx-div>
		{#if !readonly}<hx-button type="button" class="gold" onclick={add}>Add mechanic</hx-button>{/if}
	</hx-header>
	{#if mechanics.length === 0}
		<hx-p class="empty">No mechanics yet.</hx-p>
	{/if}
	<hx-ol>
		{#each mechanics as mechanic, index (index)}
			<hx-li>
				<hx-div class="head">
					<hx-label class="title">
						<hx-span>Title</hx-span>
						<hx-input
							value={mechanic.title}
							{readonly}
							oninput={(event) => update(index, { title: event.currentTarget.value })}
						/>
					</hx-label>
					<hx-code>{mechanic.id}</hx-code>
					{#if !readonly}
						<hx-button type="button" onclick={() => remove(index)}>
							Remove <hx-span class="sr">{mechanic.title}</hx-span>
						</hx-button>
					{/if}
				</hx-div>
				<hx-label>
					<hx-span>Description</hx-span>
					<hx-textarea
						rows="2"
						value={mechanic.description}
						{readonly}
						oninput={(event) => update(index, { description: event.currentTarget.value })}
					></hx-textarea>
				</hx-label>
				<hx-div class="contract">
					<hx-label>
						<hx-span>Inputs</hx-span>
						<GameTextField
							value={mechanic.inputs.join(', ')}
							placeholder="x, y, choice"
							{readonly}
							change={(text) => update(index, { inputs: names(text) })}
						/>
					</hx-label>
					<hx-label>
						<hx-span>Events</hx-span>
						<GameTextField
							value={mechanic.events.join(', ')}
							placeholder="key-collected"
							{readonly}
							change={(text) => update(index, { events: names(text) })}
						/>
					</hx-label>
				</hx-div>
			</hx-li>
		{/each}
	</hx-ol>
</hx-section>

<style>
	.mechanics {
		display: grid;
		gap: var(--hx-space-20);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--hx-space-16);
	}
	h2 {
		margin: 0 0 var(--hx-space-4);
		font-size: var(--hx-type-size-base);
	}
	header p,
	.empty {
		margin: 0;
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-sm);
	}
	ol {
		display: grid;
		gap: var(--hx-space-14);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		gap: var(--hx-space-12);
		padding: var(--hx-space-18);
		border: var(--hx-border-thin) solid var(--hx-color-border);
		border-radius: var(--hx-radius-large);
		background: var(--hx-color-surface);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--hx-space-12);
	}
	.title {
		flex: 1 1 220px;
		min-width: 0;
	}
	.title input {
		min-width: 0;
	}
	label {
		display: grid;
		gap: var(--hx-space-6);
	}
	label span {
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
		letter-spacing: var(--hx-style-tracking-wide);
		text-transform: uppercase;
	}
	textarea {
		resize: vertical;
	}
	code {
		min-width: 0;
		padding-bottom: var(--hx-space-12);
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
		overflow-wrap: anywhere;
	}
	.contract {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--hx-space-12);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	/* On a phone the title has the row to itself; the id and Remove share the line below it. */
	@media (max-width: 560px) {
		.title {
			flex-basis: 100%;
		}
		.head button {
			margin-left: auto;
		}
	}
</style>
