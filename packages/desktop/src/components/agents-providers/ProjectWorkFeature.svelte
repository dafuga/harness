<!-- @harness-tier molecule -->
<!-- @harness-atoms ../../../../reports/src/components/shared-primitives/atoms -->
<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import type {
		FeatureWorkSnapshot,
		FeatureWorkTask as Task
	} from '../../../../../src/services/agents-providers/FeatureWorkService.types';
	import type {
		FeaturePlan as Plan,
		FeaturePlanChange as Change,
		FeaturePlanPage as Page
	} from '../../../../../src/repositories/agents-providers/ModuleTaskRepository.types';
	type Feature = FeatureWorkSnapshot['features'][number];

	let {
		feature: f,
		initiallyOpen
	}: { feature: FeatureWorkSnapshot['features'][number]; initiallyOpen: boolean } = $props();
	// Initialize once; subsequent queue refreshes must preserve the user's choice.
	// svelte-ignore state_referenced_locally
	let expanded = $state(initiallyOpen);

	const STATUS: Record<string, { label: string; tone: string }> = {
		queued: { label: 'To do', tone: 'gray' },
		running: { label: 'In progress', tone: 'amber' },
		review: { label: 'In review', tone: 'amber' },
		accepted: { label: 'Accepted', tone: 'green' },
		failed: { label: 'Failed', tone: 'red' }
	};
	const KIND: Record<string, string> = {
		add: 'Add',
		modify: 'Modify',
		remove: 'Remove',
		reuse: 'Reuse'
	};
	const FIELDS = ['inputs', 'outputs', 'errors'] as const;
	const statusOf = (t: Task) => STATUS[t.status] ?? { label: `Status ${t.status}`, tone: 'gray' };
	const short = (commit: string) => commit.slice(0, 7);
	const nameOf = (f: Feature, id: string) =>
		f.tasks.find((t) => t.id === id)?.title ?? `missing task ${id}`;
	const plannedOnly = (f: Feature) =>
		(f.plan?.tasks ?? []).filter((p) => !f.tasks.some((t) => t.id === p.id));
	const selection = (page: Page) =>
		page.selected ? `Selected ${page.selected}` : 'No option selected';

	function progress(f: Feature) {
		const accepted = f.tasks.filter((t) => t.status === 'accepted').length;
		const stored = f.tasks.length
			? `${accepted} of ${f.tasks.length} stored tasks accepted`
			: 'No stored tasks';
		const planned = plannedOnly(f).length;
		return planned ? `${stored} · ${planned} planned, not stored` : stored;
	}

	// Ordered parent/child forest; each change renders once, even inside a malformed parent cycle.
	function changeTree(changes: Change[]) {
		const units = new Set(changes.map((c) => c.unit));
		const roots: Change[] = [];
		const kids = new SvelteMap<Change, Change[]>();
		const place = (c: Change, siblings: Change[]) => {
			if (kids.has(c)) return;
			const own: Change[] = [];
			kids.set(c, own);
			siblings.push(c);
			changes.filter((k) => k.parent === c.unit).forEach((k) => place(k, own));
		};
		const tops = changes.filter((c) => !c.parent || c.parent === c.unit || !units.has(c.parent));
		[...tops, ...changes].forEach((c) => place(c, roots));
		return { roots, kids };
	}

	function otherModules(f: Feature) {
		const units = new Set(f.plan?.changes.map((c) => c.unit));
		return [...new Set([...f.tasks, ...plannedOnly(f)].map((t) => t.module))].filter(
			(m) => !units.has(m)
		);
	}
</script>

<li>
	<details bind:open={expanded}>
		<summary>
			<strong class="grow">{f.goal || f.id}</strong>
			<small class="full">{f.id} · {progress(f)}</small>
		</summary>
		{#if f.tldr}<p class="meta">{f.tldr}</p>{/if}
		{#if f.plan}
			{@render planView(f, f.plan)}
		{:else}
			<p class="meta">No committed plan for this feature.</p>
		{/if}
		{#each otherModules(f) as m (m)}
			<p class="meta">
				<code>{m}</code>{f.plan ? ' · not among this plan’s changes' : ''}
			</p>
			{@render moduleTasks(f, m)}
		{/each}
	</details>
</li>

{#snippet planView(f: Feature, p: Plan)}
	{@const tree = changeTree(p.changes)}
	<p class="meta">
		Plan revision {p.revision} from <code title={p.sourceCommit}>{short(p.sourceCommit)}</code> ·
		{#if !p.approval}not approved{:else if p.approval.digest !== p.digest}approval is for a
			different digest{:else}approved by {p.approval.reviewer} at
			<time datetime={p.approval.approvedAt}>{p.approval.approvedAt}</time>{/if}
	</p>
	<p class="meta">Design previews and approval controls are not available in this panel.</p>
	{#each p.pages as page (page.module)}
		<details>
			<summary
				><span class="grow">Design <code>{page.module}</code></span><span class="tag"
					>{selection(page)}</span
				></summary
			>
			<ul class="tree">
				{#each page.options as o (o.id)}
					<li class="row">
						<span class="grow">{o.id} · {o.version}</span>
						{#if o.id === page.selected}<span class="tag amber">Selected</span>{/if}
						{#if o.preferred}<span class="tag amber">Preferred</span>{/if}
						<code class="full" title="sha256 {o.sha256}">{o.path} @ {short(o.commit)}</code>
					</li>
				{/each}
			</ul>
		</details>
	{/each}
	{#if tree.roots.length}
		<ul class="tree">
			{#each tree.roots as c (c.unit)}{@render changeNode(f, c, tree.kids)}{/each}
		</ul>
	{:else}
		<p class="meta">This plan lists no module changes.</p>
	{/if}
{/snippet}

{#snippet changeNode(f: Feature, c: Change, kids: Map<Change, Change[]>)}
	<li>
		<details open>
			<summary
				><code class="grow">{c.unit}</code><span class="tag">{KIND[c.kind] ?? c.kind}</span
				></summary
			>
			{#if c.wantedContract}
				{@const w = c.wantedContract}
				<details>
					<summary>Wanted contract</summary>
					<p class="meta">{w.responsibility}</p>
					{#each FIELDS as field (field)}
						{@const entries = w[field] ?? []}
						<p class="meta label">{field}{entries.length ? '' : ': none declared'}</p>
						{#each entries as e, index (index)}
							<p class="meta">
								<code>{e.name}</code>{e.type ? `: ${e.type}` : ''}{e.description
									? ` — ${e.description}`
									: ''}
							</p>
						{/each}
					{/each}
				</details>
			{/if}
			{#if c.assignedFiles.length}<p class="meta">Files: {c.assignedFiles.join(', ')}</p>{/if}
			{@render moduleTasks(f, c.unit)}
			{#if kids.get(c)?.length}<ul class="tree">
					{#each kids.get(c) ?? [] as k (k.unit)}{@render changeNode(f, k, kids)}{/each}
				</ul>{/if}
		</details>
	</li>
{/snippet}

{#snippet moduleTasks(f: Feature, module: string)}
	{@const stored = f.tasks.filter((t) => t.module === module)}
	{@const planned = plannedOnly(f).filter((t) => t.module === module)}
	{#if stored.length || planned.length}
		<ul class="tree">
			{#each stored as t (t.id)}
				{@const s = statusOf(t)}
				<li>
					<details>
						<summary>
							<span class="dot {s.tone}" aria-hidden="true"></span>
							<span class="grow">{t.title}</span>
							<span class="status {s.tone}">{s.label}</span>
							{#if t.blockedBy.length}<small class="full end"
									>Waiting on {t.blockedBy.map((id) => nameOf(f, id)).join(', ')}</small
								>{/if}
						</summary>
						<p class="meta">
							Task <code>{t.id}</code>{t.belongsToPlan ? '' : ' · not in the current plan'}
						</p>
						<p class="meta">
							Depends on {t.dependsOn.map((id) => nameOf(f, id)).join(', ') || 'no tasks'}
						</p>
					</details>
				</li>
			{/each}
			{#each planned as t (t.id)}
				<li class="row planned">
					<span class="dot" aria-hidden="true"></span><span class="grow">{t.title}</span><span
						>Planned, not stored</span
					>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}
