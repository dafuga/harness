<script lang="ts">
	import type { HarnessUnit } from '../../models/Harness.types';
	// Mounted only when a person opens Details → Source; no other screen renders what a unit owns.
	let { unit }: { unit: HarnessUnit } = $props();
</script>

<section class="ex-card" aria-labelledby="ex-source-title">
	<h2 id="ex-source-title">Source ownership</h2>
	<p class="ex-soft">The files and symbols this entity owns at this revision.</p>
	<div class="ex-config">
		<div>
			<h3>Files</h3>
			{#if unit.owns.source.length === 0}<p class="ex-soft">It owns no file.</p>{/if}
			<ul class="ex-links ex-mono">
				{#each unit.owns.source as file, position (position)}<li>{file}</li>{/each}
			</ul>
		</div>
		<div>
			<h3>Symbols</h3>
			{#if unit.owns.symbols.length === 0}<p class="ex-soft">It names no symbol.</p>{/if}
			<ul class="ex-links ex-mono">
				{#each unit.owns.symbols as symbol, position (position)}<li>{symbol}</li>{/each}
			</ul>
		</div>
		<div>
			<h3>Execution targets</h3>
			<ul class="ex-links ex-mono">
				{#each unit.runtime.targets as target, position (position)}
					<li>{target.kind} · {target.entry}</li>
				{/each}
			</ul>
		</div>
	</div>
	<p class="ex-note">Identity {unit.id} · version {unit.version}</p>
</section>
