# Service review history

`objects.pack` is a Git pack of the committed objects that
`specification/loops/shared-service-ownership/migration.json` names. A verification snapshot is
tracked source without a repository, so `test/support/serviceMoveReviews.ts` loads this pack into a
temporary bare repository of its own and reads every reviewed source from it with
`git rev-parse` and `git show`. Object ids are hashes of their contents: a damaged pack, a commit
it does not hold, or another path does not verify. Nothing falls back to a surrounding repository.

## What it holds

- The SHA-1 object format with the original proof and committed behavior reviews. There are no refs;
  parent history is not traversed.
- For the ledger's `originalProof` and each file's current and previous reviews, it holds the commit, its root tree,
  every tree down the path and the blob at that path.
- The commits: `16ab6fdf66c235918411bf42bb02e39653653a05` (original proof),
  `0816efe0e469ca8c3963f583590289d253961a79`, `9fb0505ef04992cc5b1716d2b7b5280d4f866036` and
  `0f968c6c98050fb14bf7f7a29d174352755a87d2`,
  `1bf1e0acb343c3894a34781787bd67cd41c57317`, `acb1a676d2a5186986369c5a4fb52ec1eabdaae9` and
  `ff91d603c94486efdaddde9cd5e5288703cf38e2`. Earlier reviewed objects remain present. The original HistoryIndexService implementation
  is retained alongside its migration record.

The Layouts update also retains implementation commit `ae9e65325` for layout design,
planning writes and immutable formatter ignores.

## Regenerating it

Regenerate it when a review names another commit or path. Run this from a checkout whose Git
holds those commits, with the script below saved outside the repository as `review-objects.ts`:

```ts
const d = JSON.parse(
	await Bun.file('specification/loops/shared-service-ownership/migration.json').text()
);
const reads = [
	[d.originalProof, 'specification/loops/shared-service-ownership/migration.json'],
	[d.originalProof, 'src/cli/program/history-index-service/HistoryIndexService.ts'],
	...d.files.flatMap((f) =>
		[...(f.review ? [f.review] : []), ...(f.previousReviews ?? [])].map((r) => [r.commit, r.path])
	)
];
const ids = new Set();
const id = (name) => {
	const result = Bun.spawnSync(['git', 'rev-parse', '--verify', name]);
	if (result.exitCode !== 0) throw new Error(`Missing committed source: ${name}`);
	return result.stdout.toString().trim();
};
for (const [commit, path] of reads) {
	const parts = path.split('/');
	for (const name of [
		commit + '^{commit}',
		commit + '^{tree}',
		...parts.map((_, i) => commit + ':' + parts.slice(0, i + 1).join('/'))
	])
		ids.add(id(name));
}
console.log([...ids].sort().join('\n'));
```

```sh
bun review-objects.ts > ids.txt
git pack-objects --stdout --threads=1 < ids.txt > test/support/service-review-history/objects.pack
```

The pack's bytes can differ between Git versions; its object ids cannot. Check a new pack with
`git index-pack --stdin` into an empty bare repository, then run `test/services/unit-index.test.ts`.

Benchmark analytics retains implementation commit `9425223b3` for the additive query registration, rendering and snapshot fields.

Resource admission retains implementation commit `43dacd370` for evaluator, verification and priority changes. Original relocation proofs and prior behavior reviews remain present.
