<script lang="ts">
	import type { Props } from './GameCheckpointEditor.types';

	import Select from '$shared/Select.svelte';
	import GameTextField from './GameTextField.svelte';
	import type { Checkpoint, Condition, GameAction } from '../../../../game/src/index';
	let { checkpoint, change, readonly = false }: Props = $props();
	const ops: Record<Condition['op'], string> = { eq: 'equals', gte: 'at least', lte: 'at most' };
	const kinds = { set: 'Set', emit: 'Emit', transition: 'Transition', visibility: 'Visibility' };
	/** True and false read as booleans and numeric text as numbers; anything else stays text. */
	function parse(text: string): Condition['value'] {
		const t = text.trim();
		if (t === 'true' || t === 'false') return t === 'true';
		return t !== '' && Number.isFinite(Number(t)) ? Number(t) : text;
	}
	function update(patch: Partial<Checkpoint>) {
		if (checkpoint) change({ ...checkpoint, ...patch });
	}
	function replace<T>(list: T[], i: number, patch: Partial<T>): T[] {
		return list.map((item, j) => (j === i ? { ...item, ...patch } : item));
	}
	function without<T>(list: T[], i: number): T[] {
		return list.filter((_, j) => j !== i);
	}
	function condition(node: Checkpoint, i: number, patch: Partial<Condition>) {
		update({ conditions: replace(node.conditions, i, patch) });
	}
	function action(node: Checkpoint, i: number, patch: Partial<GameAction>) {
		update({ actions: replace(node.actions, i, patch) });
	}
	function addCondition(node: Checkpoint) {
		update({ conditions: [...node.conditions, { field: '', op: 'eq', value: true }] });
	}
	function addAction(node: Checkpoint) {
		update({ actions: [...node.actions, { type: 'set', target: '', value: true }] });
	}
	function requires(node: Checkpoint, text: string) {
		const ids = new Set(text.split(',').map((id) => id.trim()));
		update({ requires: [...ids].filter((id) => id && id !== node.id) });
	}
</script>

<section class="editor" data-harness-component="game-checkpoint-editor" aria-label="Rules">
	{#if checkpoint}
		{@const node = checkpoint}
		{#key node.id}
			<fieldset disabled={readonly}>
				<label>
					<span>Prerequisites</span>
					<GameTextField
						value={node.requires.join(', ')}
						placeholder="Checkpoint ids, comma separated"
						change={(text) => requires(node, text)}
					/>
				</label>
				<label class="check">
					<input
						type="checkbox"
						checked={node.repeatable ?? false}
						onchange={(e) => update({ repeatable: e.currentTarget.checked })}
					/>
					Repeatable
				</label>
				<div class="head">
					<h3>Conditions</h3>
					<button type="button" onclick={() => addCondition(node)}>Add condition</button>
				</div>
				{#each node.conditions as c, i (i)}
					<div class="row" role="group" aria-label="Condition {i + 1}">
						<GameTextField
							label="Condition {i + 1} field"
							placeholder="Field"
							value={c.field}
							change={(field) => condition(node, i, { field })}
						/>
						<Select
							label="Condition {i + 1} comparison"
							bind:value={() => c.op, (op) => condition(node, i, { op: op as typeof c.op })}
						>
							{#each Object.entries(ops) as [op, t] (op)}<option value={op}>{t}</option>{/each}
						</Select>
						<GameTextField
							label="Condition {i + 1} value"
							placeholder="Value"
							value={String(c.value)}
							change={(text) => condition(node, i, { value: parse(text) })}
						/>
						<button
							type="button"
							aria-label="Remove condition {i + 1}"
							onclick={() => update({ conditions: without(node.conditions, i) })}
						>
							Remove
						</button>
					</div>
				{/each}
				<div class="head">
					<h3>Actions</h3>
					<button type="button" onclick={() => addAction(node)}>Add action</button>
				</div>
				{#each node.actions as a, i (i)}
					<div class="row" role="group" aria-label="Action {i + 1}">
						<Select
							label="Action {i + 1} type"
							bind:value={() => a.type, (t) => action(node, i, { type: t as typeof a.type })}
						>
							{#each Object.entries(kinds) as [k, t] (k)}<option value={k}>{t}</option>{/each}
						</Select>
						<GameTextField
							label="Action {i + 1} target"
							placeholder="Target"
							value={a.target}
							change={(target) => action(node, i, { target })}
						/>
						<GameTextField
							label="Action {i + 1} value"
							placeholder="Value"
							value={String(a.value)}
							change={(text) => action(node, i, { value: parse(text) })}
						/>
						<button
							type="button"
							aria-label="Remove action {i + 1}"
							onclick={() => update({ actions: without(node.actions, i) })}
						>
							Remove
						</button>
					</div>
				{/each}
				<p class="hint">Values are read as true or false, a number, or text.</p>
			</fieldset>
		{/key}
	{:else}
		<p class="hint">Select a checkpoint to edit it.</p>
	{/if}
</section>

<style>
	.editor,
	fieldset {
		display: grid;
		gap: var(--hx-space-16);
	}
	fieldset {
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	label {
		display: grid;
		gap: var(--hx-space-8);
	}
	label > span,
	h3 {
		margin: 0;
		color: var(--hx-color-text-muted);
		font-size: var(--hx-type-size-xs);
		letter-spacing: var(--hx-style-tracking-caps);
		text-transform: uppercase;
	}
	input:focus-visible {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
	}
	.check {
		display: flex;
		align-items: center;
		gap: var(--hx-space-10);
	}
	.check input {
		width: 18px;
		height: 18px;
		accent-color: var(--hx-color-primary);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr)) auto;
		gap: var(--hx-space-8);
	}
	@media (max-width: 560px) {
		.row {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	button:hover:not(:disabled) {
		border-color: var(--hx-color-primary);
		color: var(--hx-color-primary);
	}
	.hint {
		margin: 0;
		color: var(--hx-color-text-muted);
	}
</style>
