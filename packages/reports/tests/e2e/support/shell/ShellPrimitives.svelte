<script lang="ts">
	import HarnessAction from '../../../../src/components/explorer-ui/HarnessAction.svelte';
	import NativeAtomsForm from './NativeAtomsForm.svelte';
	import HarnessIcon from '../../../../src/components/explorer-ui/HarnessIcon.svelte';
	import HarnessNavbar from '../../../../src/components/explorer-ui/harness-navbar/HarnessNavbar.svelte';
	import HarnessSelectors from '../../../../src/components/explorer-ui/harness-selectors/HarnessSelectors.svelte';
	import HarnessTabs from '../../../../src/components/explorer-ui/HarnessTabs.svelte';
	import HarnessVerdict from '../../../../src/components/explorer-ui/harness-verdict/HarnessVerdict.svelte';
	import { harnessIcons, type HarnessIconName } from '../../../../src/utils/harnessIcons';
	import { sha, shellBranch, shellCommits, shellHref, shellIndex, shellMount } from '../shellData';
	// Every shared piece of the shell once, inside the explorer, and the two rows of the console
	// that was outside it, where no explorer rule may reach them.
	const names = Object.keys(harnessIcons) as HarnessIconName[];
	const sections = [
		{ id: 'contract', label: 'Contract', href: '/harness/contract' },
		{ id: 'measurements', label: 'Measurements', href: '/harness/measurements' },
		{ id: 'source', label: 'Source', disabled: true },
		{ id: 'history', label: 'History' }
	];
	const sheet =
		'display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:4px 12px;';
	const cell = 'display:flex;align-items:center;gap:8px;margin:0;line-height:1.3;';
	let section = $state('contract');
	// The same tabs in a strip narrower than they are, opened on its last tab, as an entity is
	// when its History is the page that was asked for.
	let narrow = $state('history');
	let view = $state('map');
	let pressed = $state(0);
	let changed = $state(false);
	const nothing = () => {};
	// More reasons than a short screen has room for: they are read by scrolling the tooltip.
	const many = Array.from(
		{ length: 40 },
		(_, at) => `reason ${at + 1}: a state and viewport that has no capture of its own`
	);
	// Reasons long enough to need the width a tooltip may take, at either edge of a narrow table.
	const why = [
		'no capture of the state with no results at the mobile viewport',
		'the record that covers it belongs to another commit'
	];
</script>

<div class="hx-shell">
	<section aria-label="Bar without an address">
		<HarnessNavbar
			base={shellMount}
			repository={null}
			scope={null}
			index={null}
			commits={[]}
			href={shellHref}
			onroute={nothing}
		/>
	</section>
	<p class="hc-muted" role="status">Loading history…</p>
	<main class="hx-main">
		<nav class="hx-crumbs" aria-label="Breadcrumb">
			<ol>
				<li><a href="/harness/pages">Pages</a></li>
				<li><a href="/harness/pages/page.titles">Page explorer</a></li>
				<li aria-current="page">Details</li>
			</ol>
		</nav>
		<h2>Shared pieces of the explorer shell</h2>
		<ul aria-label="Icons" style="{sheet}margin:0 0 16px;padding:0;list-style:none;">
			{#each names as name (name)}
				<li data-icon={name} style={cell}><HarnessIcon {name} size={24} /><span>{name}</span></li>
			{/each}
		</ul>
		<p aria-label="Verdicts" style="display:flex;flex-wrap:wrap;gap:12px 24px;align-items:center;">
			<HarnessVerdict passed={true} />
			<HarnessVerdict passed={false} label="Evidence missing" reasons={['no capture at mobile']} />
			<HarnessVerdict passed={true} label="Full coverage passed" framed />
			<HarnessVerdict passed={false} label="Coverage incomplete" framed />
			<HarnessVerdict passed={true} label="Passed" bare />
			<HarnessVerdict passed={false} label="Failed" bare />
			<HarnessVerdict passed={false} label="Many reasons" reasons={many} />
		</p>
		<div class="hx-scroll-x" role="group" aria-label="Narrow table">
			<table style="width:100%;border-collapse:collapse;">
				<tbody>
					<tr>
						<td><HarnessVerdict passed={false} label="Stale evidence" reasons={why} /></td>
						<td style="width:100%;padding:0 12px;">A row of a catalogue</td>
						<td><HarnessVerdict passed={false} label="Coverage incomplete" reasons={why} /></td>
					</tr>
				</tbody>
			</table>
		</div>
		<p aria-label="Actions" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
			<HarnessAction href="/harness/open" icon="arrow-right" onclick={() => (pressed += 1)}
				>Open page</HarnessAction
			>
			<HarnessAction tone="plain" lead="arrow-left" onclick={() => (pressed += 1)}
				>Back to overview</HarnessAction
			>
			<HarnessAction disabled icon="arrow-right">Go to tip</HarnessAction>
			<output aria-label="Pressed">{pressed}</output>
		</p>
		<HarnessTabs label="Sections" view={section} tabs={sections} onview={(id) => (section = id)} />
		<p>Section <output aria-label="Section">{section}</output></p>
		<div style="max-width:230px;">
			<HarnessTabs
				label="Narrow sections"
				view={narrow}
				tabs={sections}
				onview={(id) => (narrow = id)}
			/>
		</div>
		<p style="display:flex;flex-wrap:wrap;gap:12px;">
			<HarnessAction tone="plain" onclick={() => (narrow = 'contract')}>Show contract</HarnessAction
			>
			<HarnessAction tone="plain" onclick={() => (narrow = 'history')}>Show history</HarnessAction>
			<HarnessAction tone="plain" onclick={() => (section = 'history')}>Open history</HarnessAction>
		</p>
		<div class="hx-card" aria-label="Shared classes" role="group">
			<p style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
				<label class="hx-field" style="flex:1 1 260px;"
					><HarnessIcon name="search" /><input type="search" placeholder="Search pages…" /></label
				>
				<label class="hx-toggle"
					><input type="checkbox" role="switch" bind:checked={changed} />Changed only</label
				>
				<span class="hx-pill">Page</span>
				<span class="hx-pill gold">Shared</span>
			</p>
			<p class="hx-notice fail">No capture of this state is recorded at the viewed commit.</p>
			<p class="hx-muted">Not measured · <span class="hx-mono">{sha(4)}</span></p>
		</div>
	</main>
</div>
<section aria-label="Legacy console rows" class="hc-shell">
	<HarnessSelectors
		index={shellIndex}
		branch={shellBranch}
		commit={sha(4)}
		commits={shellCommits(shellBranch)}
		bases={null}
		from=""
		onbranch={nothing}
		oncommit={nothing}
		onbase={nothing}
	/>
	<HarnessTabs {view} onview={(id) => (view = id)} />
</section>
<NativeAtomsForm />
