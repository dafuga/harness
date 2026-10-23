# Service review history

`objects.pack` is a Git pack of the committed objects that
`specification/loops/shared-service-ownership/migration.json` names. A verification snapshot is
tracked source without a repository, so `test/support/serviceMoveReviews.ts` loads this pack into a
temporary bare repository of its own and reads every reviewed source from it with
`git rev-parse` and `git show`. Object ids are hashes of their contents: a damaged pack, a commit
it does not hold, or another path does not verify. Nothing falls back to a surrounding repository.

## What it holds

- SHA-1 Git commit, tree and blob objects for the ledger's original proof and every current and previous review. No refs or unrelated source blobs are included.
- Each reviewed source path and every tree down to it; parent history is not traversed. The original HistoryIndexService source and migration record remain present.
- The repository-wide type migration retains prior reviews and adds committed source reviews for mechanical companion-file extraction. Later Source-tab test archiving keeps its own reviewed implementation.

The Layouts update also retains implementation commit `ae9e65325` for layout design,
planning writes and immutable formatter ignores.

The level planning review retains implementation commit `f6a7a2129` for the desktop bridge
factory and isolated preload.

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
