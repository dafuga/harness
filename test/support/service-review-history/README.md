# Service review history

`objects.pack` is a Git pack of the committed objects that
`specification/loops/shared-service-ownership/migration.json` names. A verification snapshot is
tracked source without a repository, so `test/support/serviceMoveReviews.ts` loads this pack into a
temporary bare repository of its own and reads every reviewed source from it with
`git rev-parse` and `git show`. Object ids are hashes of their contents: a damaged pack, a commit
it does not hold, or another path does not verify. Nothing falls back to a surrounding repository.

## What it holds

- SHA-1 objects: 105 objects, including 7 commits, 67 trees and 31 blobs. No refs or parent traversal are needed.
- The original pack is retained, with the paths named by current and previous reviews added.
- Each review has its exact commit, root tree, every tree down its path and the source blob.
- The current capture/history changes are reviewed at main `ff91d603c94486efdaddde9cd5e5288703cf38e2`.

## Regenerating it

Regenerate it when a review names another commit or path. Run this from a checkout whose Git
holds those commits, with the script below saved outside the repository as `review-objects.ts`:

```ts
const d = JSON.parse(
	await Bun.file('specification/loops/shared-service-ownership/migration.json').text()
);
const reads = [
	[d.originalProof, 'specification/loops/shared-service-ownership/migration.json'],
	...d.files.filter((f) => f.review).map((f) => [f.review.commit, f.review.path])
];
const ids = new Set();
const id = (name) => Bun.spawnSync(['git', 'rev-parse', '--verify', name]).stdout.toString().trim();
for (const [commit, path] of reads) {
	const parts = path.split('/');
	for (const name of [
		commit + '^{commit}',
		commit + '^{tree}',
		...parts.map((_, i) => commit + ':' + parts.slice(0, i + 1).join('/'))
	])
		ids.add(id(name));
}
console.log([...ids].join('\n'));
```

```sh
bun review-objects.ts > ids.txt
git pack-objects --stdout --threads=1 < ids.txt > test/support/service-review-history/objects.pack
```

The pack's bytes can differ between Git versions; its object ids cannot. Check a new pack with
`git index-pack --stdin` into an empty bare repository, then run `test/services/unit-index.test.ts`.
