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

	type Preview = { url?: string; error?: string; loading?: boolean };
	type Select = (input: {
		feature: string;
		page: string;
		option: string;
		expectedDigest: string;
	}) => Promise<boolean>;
	let {
		feature: f,
		previewFor,
		loadPage,
		select,
		pending = false
	}: {
		feature: FeatureWorkSnapshot['features'][number];
		previewFor: (page: Page, option: Page['options'][number]) => Preview;
		loadPage: (page: Page) => Promise<void>;
		select: Select;
		pending?: boolean;
	} = $props();

	const STATUS: Record<string, { label: string; tone: string }> = {
		queued: { label: 'To do', tone: 'gray' },
		running: { label: 'In progress', tone: 'amber' },
		review: { label: 'In review', tone: 'amber' },
		accepted: { label: 'Completed', tone: 'green' },
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
	const nameOf = (f: FeatureWorkSnapshot['features'][number], id: string) =>
		f.tasks.find((t) => t.id === id)?.title ?? `missing task ${id}`;
	const plannedOnly = (f: FeatureWorkSnapshot['features'][number]) =>
		(f.plan?.tasks ?? []).filter((p) => !f.tasks.some((t) => t.id === p.id));
	const selection = (page: Page) =>
		page.selected ? `Selected ${page.selected}` : 'No option selected';

	function changeTree(changes: Change[]) {
		const units = new Set(changes.map((c) => c.unit)),
			roots: Change[] = [],
			kids = new SvelteMap<Change, Change[]>();
		const place = (c: Change, siblings: Change[]) => {
			if (kids.has(c)) return;
			const own: Change[] = [];
			kids.set(c, own);
			siblings.push(c);
			for (const child of changes) if (child.parent === c.unit) place(child, own);
		};
		const tops = changes.filter((c) => !c.parent || c.parent === c.unit || !units.has(c.parent));
		for (const change of [...tops, ...changes]) place(change, roots);
		return { roots, kids };
	}

	function otherModules(f: FeatureWorkSnapshot['features'][number]) {
		const units = new Set(f.plan?.changes.map((c) => c.unit));
		return [...new Set([...f.tasks, ...plannedOnly(f)].map((t) => t.module))].filter(
			(m) => !units.has(m)
		);
	}
</script>

{#if f.tldr}<hx-p class="meta">{f.tldr}</hx-p>{/if}
{#if f.plan}{@render planView(f, f.plan)}{:else}<hx-p class="meta"
		>No committed plan for this feature.</hx-p
	>{/if}
{#each otherModules(f) as m (m)}<hx-p class="meta"
		><hx-code>{m}</hx-code>{f.plan ? ' · not among this plan’s changes' : ''}</hx-p
	>{@render moduleTasks(f, m)}{/each}

{#snippet planView(f: FeatureWorkSnapshot['features'][number], p: Plan)}
	{@const tree = changeTree(p.changes)}
	<hx-p class="meta">
		Plan revision {p.revision} from
		<hx-code title={p.sourceCommit}>{short(p.sourceCommit)}</hx-code>
		·
		{#if !p.approval}not approved{:else if p.approval.digest !== p.digest}approval is for a
			different digest{:else}approved by {p.approval.reviewer} at
			<hx-time datetime={p.approval.approvedAt}>{p.approval.approvedAt}</hx-time>{/if}
	</hx-p>
	{#each p.pages as page (page.module)}
		<hx-details
			ontoggle={(event) => (event.currentTarget as HTMLDetailsElement).open && loadPage(page)}
		>
			<hx-summary
				><hx-span class="grow">Design <hx-code>{page.module}</hx-code></hx-span><hx-span class="tag"
					>{selection(page)}</hx-span
				></hx-summary
			>
			<hx-div class="option-grid" aria-label={`Design options for ${page.module}`}>
				{#each page.options as o (o.id)}
					{@const preview = previewFor(page, o)}
					<hx-div class="option-card">
						{#if preview?.url}<img
								src={preview.url}
								alt={`Design ${o.id} for ${page.module}`}
								loading="lazy"
							/>
						{:else if preview?.error}<hx-p class="image-error" role="alert">{preview.error}</hx-p>
						{:else}<hx-p class="image-placeholder"
								>{preview?.loading
									? 'Loading exact preview…'
									: 'Expand this page to load previews.'}</hx-p
							>{/if}
						<hx-div class="option-meta"
							><hx-strong>{o.id}</hx-strong>{#if o.id === page.selected}<hx-span class="tag amber"
									>Selected</hx-span
								>{/if}{#if o.preferred}<hx-span class="tag">Preferred</hx-span>{/if}</hx-div
						>
						<hx-code title="sha256 {o.sha256}">{o.path} @ {short(o.commit)}</hx-code>
						<hx-button
							type="button"
							disabled={pending || Boolean(p.approval)}
							aria-pressed={o.id === page.selected}
							onclick={() =>
								select({
									feature: f.id,
									page: page.module,
									option: o.id,
									expectedDigest: p.digest
								})}>Choose this design</hx-button
						>
					</hx-div>
				{/each}
			</hx-div>
		</hx-details>
	{/each}
	{#if tree.roots.length}
		<hx-ul class="tree">
			{#each tree.roots as c (c.unit)}{@render changeNode(f, c, tree.kids)}{/each}
		</hx-ul>
	{:else}
		<hx-p class="meta">This plan lists no module changes.</hx-p>
	{/if}
{/snippet}

{#snippet changeNode(
	f: FeatureWorkSnapshot['features'][number],
	c: Change,
	kids: Map<Change, Change[]>
)}
	<hx-li>
		<hx-details open>
			<hx-summary
				><hx-code class="grow">{c.unit}</hx-code><hx-span class="tag"
					>{KIND[c.kind] ?? c.kind}</hx-span
				></hx-summary
			>
			{#if c.wantedContract}
				{@const w = c.wantedContract}
				<hx-details>
					<hx-summary>Wanted contract</hx-summary>
					<hx-p class="meta">{w.responsibility}</hx-p>
					{#each FIELDS as field (field)}
						{@const entries = w[field] ?? []}
						<hx-p class="meta label">{field}{entries.length ? '' : ': none declared'}</hx-p>
						{#each entries as e, index (index)}
							<hx-p class="meta">
								<hx-code>{e.name}</hx-code>{e.type ? `: ${e.type}` : ''}{e.description
									? ` — ${e.description}`
									: ''}
							</hx-p>
						{/each}
					{/each}
				</hx-details>
			{/if}
			{#if c.assignedFiles.length}<hx-p class="meta">Files: {c.assignedFiles.join(', ')}</hx-p>{/if}
			{@render moduleTasks(f, c.unit)}
			{#if kids.get(c)?.length}<hx-ul class="tree">
					{#each kids.get(c) ?? [] as k (k.unit)}{@render changeNode(f, k, kids)}{/each}
				</hx-ul>{/if}
		</hx-details>
	</hx-li>
{/snippet}

{#snippet moduleTasks(f: FeatureWorkSnapshot['features'][number], module: string)}
	{@const stored = f.tasks.filter((t) => t.module === module)}
	{@const planned = plannedOnly(f).filter((t) => t.module === module)}
	{#if stored.length || planned.length}
		<hx-ul class="tree">
			{#each stored as t (t.id)}
				{@const s = statusOf(t)}
				<hx-li>
					<hx-details>
						<hx-summary>
							<hx-span class="dot {s.tone}" aria-hidden="true"></hx-span>
							<hx-span class="grow">{t.title}</hx-span>
							<hx-span class="status {s.tone}">{s.label}</hx-span>
							{#if t.blockedBy.length}<hx-small class="full end"
									>Waiting on {t.blockedBy.map((id) => nameOf(f, id)).join(', ')}</hx-small
								>{/if}
						</hx-summary>
						<hx-p class="meta">
							Task <hx-code>{t.id}</hx-code>{t.belongsToPlan ? '' : ' · not in the current plan'}
						</hx-p>
						<hx-p class="meta">
							Depends on {t.dependsOn.map((id) => nameOf(f, id)).join(', ') || 'no tasks'}
						</hx-p>
					</hx-details>
				</hx-li>
			{/each}
			{#each planned as t (t.id)}
				<hx-li class="row planned">
					<hx-span class="dot gray" aria-hidden="true"></hx-span><hx-span class="grow"
						>{t.title}</hx-span
					><hx-span>To do · planned, not stored</hx-span>
				</hx-li>
			{/each}
		</hx-ul>
	{/if}
{/snippet}

<style>
	.option-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.65rem;
	}
	.option-card {
		display: grid;
		gap: 0.45rem;
		min-width: 0;
		padding: 0.55rem;
		border: 1px solid var(--hx-border, #334155);
		border-radius: 0.65rem;
	}
	.option-card img {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 0.45rem;
	}
	.option-meta {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.image-placeholder,
	.image-error {
		min-height: 5rem;
		display: grid;
		place-items: center;
		text-align: center;
	}
	.image-error {
		color: var(--hx-danger, #ef4444);
	}
</style>
