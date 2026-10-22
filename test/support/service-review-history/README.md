# Service review history

`objects.pack` is a Git pack of the committed objects that
`specification/loops/shared-service-ownership/migration.json` names. A verification snapshot is
tracked source without a repository, so `test/support/serviceMoveReviews.ts` loads this pack into a
temporary bare repository of its own and reads every reviewed source from it with
`git rev-parse` and `git show`. Object ids are hashes of their contents: a damaged pack, a commit
it does not hold, or another path does not verify. Nothing falls back to a surrounding repository.

## What it holds

- The SHA-1 object format, 67 objects: 4 commits, 43 trees and 20 blobs. There are no refs and no
  parents.
- For the ledger's `originalProof` and each file's `review`, it holds the commit, its root tree,
  every tree down the path and the blob at that path.
- The commits: `16ab6fdf66c235918411bf42bb02e39653653a05` (original proof),
  `0816efe0e469ca8c3963f583590289d253961a79`, `9fb0505ef04992cc5b1716d2b7b5280d4f866036` and
  `0f968c6c98050fb14bf7f7a29d174352755a87d2`.

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
