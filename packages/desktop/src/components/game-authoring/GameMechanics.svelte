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

<section class="mechanics" data-harness-component="game-mechanics">
	<header>
		<div>
			<h2>Mechanics</h2>
			<p>Rules the game follows in every view. Editing them never changes the checkpoints.</p>
		</div>
		{#if !readonly}<button type="button" class="gold" onclick={add}>Add mechanic</button>{/if}
	</header>
	{#if mechanics.length === 0}
		<p class="empty">No mechanics yet.</p>
	{/if}
	<ol>
		{#each mechanics as mechanic, index (index)}
			<li>
				<div class="head">
					<label class="title">
						<span>Title</span>
						<input
							value={mechanic.title}
							{readonly}
							oninput={(event) => update(index, { title: event.currentTarget.value })}
						/>
					</label>
					<code>{mechanic.id}</code>
					{#if !readonly}
						<button type="button" onclick={() => remove(index)}>
							Remove <span class="sr">{mechanic.title}</span>
						</button>
					{/if}
				</div>
				<label>
					<span>Description</span>
					<textarea
						rows="2"
						value={mechanic.description}
						{readonly}
						oninput={(event) => update(index, { description: event.currentTarget.value })}
					></textarea>
				</label>
				<div class="contract">
					<label>
						<span>Inputs</span>
						<GameTextField
							value={mechanic.inputs.join(', ')}
							placeholder="x, y, choice"
							{readonly}
							change={(text) => update(index, { inputs: names(text) })}
						/>
					</label>
					<label>
						<span>Events</span>
						<GameTextField
							value={mechanic.events.join(', ')}
							placeholder="key-collected"
							{readonly}
							change={(text) => update(index, { events: names(text) })}
						/>
					</label>
				</div>
			</li>
		{/each}
	</ol>
</section>

<style>
	.mechanics {
		display: grid;
		gap: 20px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
	}
	h2 {
		margin: 0 0 4px;
		font-size: 1.05rem;
	}
	header p,
	.empty {
		margin: 0;
		color: var(--muted);
		font-size: 0.9rem;
	}
	ol {
		display: grid;
		gap: 14px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		gap: 12px;
		padding: 18px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--panel);
	}
	.head {
		display: flex;
		align-items: flex-end;
		gap: 12px;
	}
	.title {
		flex: 1;
	}
	label {
		display: grid;
		gap: 6px;
	}
	label span {
		color: var(--muted);
		font-size: 0.78rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	textarea {
		resize: vertical;
	}
	code {
		padding-bottom: 12px;
		color: var(--muted);
		font-size: 12px;
	}
	.contract {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
