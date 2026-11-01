<script lang="ts">
	import { onMount, type Component as SvelteComponent } from 'svelte';
	import {
		nativeAtoms,
		svgElements
	} from '../../../../../../src/templates/development-tooling/htmlElements.js';
	import { nativeAtomProps } from './nativeAtomProps';
	import { nativeAtomContent } from './nativeAtomContent';
	import {
		nativeAtomReleaseContent,
		nativeAtomLongReleaseContent
	} from './nativeAtomReleaseContent';
	let {
		Component,
		source,
		variant = ''
	}: {
		Component: SvelteComponent<Record<string, unknown>>;
		source: string;
		variant?: string;
	} = $props();
	const name = $derived(source.split('/').at(-1)?.replace('.svelte', ''));
	const definition = $derived(nativeAtoms.find((atom) => atom.name === name)!);
	const tag = $derived(definition.tag);
	const attributes = $derived(nativeAtomProps(tag, definition.type, variant));
	const example = $derived(nativeAtomContent[name ?? ''] ?? nativeAtomReleaseContent[name ?? '']);
	const stateLabels: Record<string, string> = {
		disabled: 'Disabled action',
		unlinked: nativeAtomContent.HtmlA
	};
	const label = $derived(
		tag === 'option'
			? `HtmlOption: ${variant === 'disabled' ? 'Disabled choice' : 'Available choice'}`
			: variant === 'long'
				? (nativeAtomLongReleaseContent[name ?? ''] ??
					'Long native content remains readable when a caller supplies several words and a second phrase.')
				: (stateLabels[variant] ?? example ?? name)
	);
	let host: HTMLElement;
	onMount(() => {
		const canvas = host.querySelector('canvas');
		const context = canvas?.getContext('2d');
		if (context && canvas) {
			context.fillStyle = getComputedStyle(canvas).color;
			context.fillRect(12, 12, 100, 42);
		}
	});
</script>

{#snippet tableHeading()}
	<tr><th scope="col">{tag === 'thead' ? label : 'Check'}</th><th scope="col">Status</th></tr>
{/snippet}
{#snippet tableReference()}
	<tr><td>Unit tests</td><td>Queued</td></tr>
{/snippet}
{#snippet tableRows()}
	<tr><td>{tag === 'table' || tag === 'tbody' ? label : 'Typecheck'}</td><td>Passed</td></tr>
	{@render tableReference()}
{/snippet}

{#snippet content()}
	{#if ['input', 'img', 'hr', 'video', 'audio', 'iframe', 'canvas', 'embed', 'object', 'textarea'].includes(tag)}{:else if tag === 'select' || tag === 'optgroup'}<option
			value="example">Example choice</option
		>
	{:else if tag === 'table'}<thead>{@render tableHeading()}</thead><tbody
			>{@render tableRows()}</tbody
		>
	{:else if tag === 'thead'}{@render tableHeading()}
	{:else if tag === 'tbody'}{@render tableRows()}
	{:else if tag === 'tfoot'}<tr
			><td>{variant === 'long' ? label : (example ?? 'Example cell')}</td></tr
		>
	{:else if tag === 'tr'}<td>{label}</td><td>Passed</td>
	{:else if tag === 'ul' || tag === 'ol'}<li style="list-style:inherit">
			{label}
		</li>
		<li style="list-style:inherit">Confirm the automated checks</li>
		<li style="list-style:inherit">Publish the release notes</li>
	{:else if tag === 'menu'}<li>
			{variant === 'long' ? label : (example ?? 'Example item')}
		</li>
	{:else if tag === 'dl'}<div>
			<dt>Release owner</dt>
			<dd>{label}</dd>
		</div>
	{:else if tag === 'details'}<summary>Release checks</summary>
		<p>Typecheck passed. Unit tests are queued.</p>
	{:else if tag === 'form' || tag === 'fieldset'}<label
			>{variant === 'long' ? label : (example ?? 'Example field')}
			<input
				value={variant === 'long' ? label : example ? 'Release checklist' : 'Example'}
			/></label
		><button type="button">Continue</button>
	{:else if tag === 'picture'}<img
			src={nativeAtomProps('img').src as string}
			alt="Example landscape"
			width="180"
			height="110"
		/>
	{:else if tag === 'svg' || tag === 'g'}<rect
			x="12"
			y="12"
			width="72"
			height="44"
			rx="4"
			fill="currentColor"
		/>
	{:else if ['circle', 'ellipse', 'line', 'path', 'polyline', 'polygon', 'rect', 'use', 'image'].includes(tag)}{:else if tag === 'foreignObject'}<p
		>
			Embedded content
		</p>
	{:else}{label}{/if}
{/snippet}

<div class="atom-host" bind:this={host}>
	{#if svgElements.includes(tag) && tag !== 'svg'}
		<svg width="180" height="80" viewBox="0 0 180 80" aria-label="Native SVG element context">
			<defs
				><path id="atom-shape" d="M12 60 45 15 78 60Z" fill="currentColor" /><path
					id="atom-path"
					d="M12 42h156"
				/></defs
			>
			{#if tag === 'tspan' || tag === 'textPath'}<text
					><Component {...attributes} children={content} /></text
				>
			{:else}<Component {...attributes} children={content} />{/if}
		</svg>
	{:else if ['thead', 'tbody', 'tr', 'td', 'th'].includes(tag)}<table class="native-atom-table">
			{#if tag === 'thead'}<Component {...attributes} children={content} />
			{:else}<thead>
					{#if tag === 'th'}<tr
							><Component {...attributes} children={content} /><th scope="col">Status</th></tr
						>
					{:else}{@render tableHeading()}{/if}
				</thead>{/if}
			{#if tag === 'tbody'}<Component {...attributes} children={content} />
			{:else}<tbody>
					{#if tag === 'tr'}<Component
							{...attributes}
							children={content}
						/>{@render tableReference()}
					{:else if tag === 'td'}<tr
							><Component {...attributes} children={content} /><td>Passed</td></tr
						>{@render tableReference()}
					{:else}{@render tableRows()}{/if}
				</tbody>{/if}
		</table>
	{:else if tag === 'caption' || tag === 'tfoot'}<table>
			<Component {...attributes} children={content} />
		</table>
	{:else if tag === 'li'}<ul style="list-style:disc inside">
			<Component {...attributes} children={content} />
			<li style="list-style:inherit">Check the catalog previews</li>
		</ul>
	{:else if tag === 'dt' || tag === 'dd'}<dl>
			<Component {...attributes} children={content} />
		</dl>
	{:else if tag === 'option'}<label for="native-option-context">Option choices</label>
		<select id="native-option-context" aria-label="Native option context" size="3">
			<option value="selected" selected>Selected choice</option>
			<Component {...attributes} children={content} />
			<option value="reference" disabled>Disabled reference</option>
		</select>
	{:else if tag === 'optgroup'}<select aria-label="Native option context"
			><Component {...attributes} children={content} /></select
		>
	{:else if tag === 'legend'}<fieldset>
			<Component {...attributes} children={content} />
		</fieldset>
	{:else if tag === 'summary'}<details open={variant !== 'closed'}>
			<Component {...attributes} children={content} />
			<p>Expanded summary content</p>
		</details>
	{:else if tag === 'rt' || tag === 'rp'}<ruby
			>Example<Component {...attributes} children={content} /></ruby
		>
	{:else}<Component {...attributes} children={content} />{/if}
</div>

<style>
	.atom-host {
		display: contents;
	}
	fieldset,
	table,
	ul,
	dl,
	details {
		width: max-content;
		max-width: 100%;
	}
	:global(table.native-atom-table) {
		width: 100%;
		table-layout: fixed;
		border-collapse: collapse;
	}
	:global(.native-atom-table th),
	:global(.native-atom-table td) {
		border: var(--hx-border-thin) solid var(--hx-color-border-strong);
		padding: var(--hx-space-8);
		text-align: left;
		overflow-wrap: anywhere;
	}
</style>
