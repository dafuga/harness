<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../src/components/shared-primitives/atoms -->
<script lang="ts">
	let name = $state('Example'),
		count = $state(0),
		enabled = $state(false);
	let choice = $state('one'),
		group = $state<string[]>([]),
		notes = $state('');
	let submitted = $state(0),
		closed = $state(false);
	let dialog: HTMLDialogElement;
	function ready(node: HTMLElement) {
		node.dataset.atomReady = 'true';
	}
</script>

<hx-form
	aria-label="Native atom interactions"
	onsubmit={(event) => {
		event.preventDefault();
		submitted++;
	}}
>
	<hx-fieldset>
		<hx-legend>Native element atoms</hx-legend>
		<hx-label>Name<hx-input type="text" bind:value={name} required use:ready /></hx-label>
		<hx-label>Count<hx-input type="number" bind:value={count} /></hx-label>
		<hx-label><hx-input type="checkbox" bind:checked={enabled} />Enable submit</hx-label>
		<hx-label
			>Choice<hx-select bind:value={choice}
				><hx-option value="one">One</hx-option><hx-option value="two">Two</hx-option></hx-select
			></hx-label
		>
		<hx-label><hx-input type="checkbox" bind:group value="one" />Group one</hx-label>
		<hx-label><hx-input type="checkbox" bind:group value="two" />Group two</hx-label>
		<hx-label>Notes<hx-textarea bind:value={notes} /></hx-label>
		<hx-button type="submit" disabled={!enabled} class:active={enabled}
			>Submit native form</hx-button
		>
		<hx-button type="button" onclick={() => dialog.showModal()}>Open native dialog</hx-button>
		<hx-output aria-label="Native values"
			>{JSON.stringify({
				name,
				count,
				enabled,
				choice,
				group,
				notes,
				submitted,
				closed
			})}</hx-output
		>
	</hx-fieldset>
</hx-form>
<hx-dialog bind:this={dialog} aria-label="Native dialog" onclose={() => (closed = true)}>
	<hx-p>Native dialog content</hx-p>
	<hx-button type="button" onclick={() => dialog.close()}>Close native dialog</hx-button>
</hx-dialog>

<style>
	fieldset {
		display: grid;
		gap: var(--hx-space-12);
	}
	button.active {
		outline: var(--hx-border-thick) solid var(--hx-color-primary);
	}
</style>
