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

The design canvas review retains the committed Hub API controller and projection service that
read a revision's canvases.

The Mac design canvas review retains the committed bridge factory and isolated preload that read
the checkout's canvases.

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

Scoped screenshot admission retains implementation commit `b0fc91c01` for selected-revision registry validation. The original service move and every earlier implementation review remain included.

Report export removal retains implementation commit `0a97ffe38` for the console host files that no longer generate the export route.

The retained report CLI description is reviewed at `325d2720a`; the pack also retains its original relocation proof.

The improvements-branch reviews retain implementation commits `58a619d02` (evaluator diagnostics,
deadlines, credentials and closed-loop refusal), `c4221b3bf` (kernel benchmark process bounds),
`664955c22` (units check storage warnings), `745253c62` (loop closure and stored evidence),
`55c266df8` (preview worker environment and credentials) and `1c8072c51` (report serve loopback
origin, a first review of that moved file).

When an earlier review commit is no longer in the local Git store, resolve the ids from a temporary
bare repository that holds the previous pack and borrows the checkout's objects: `git index-pack
--stdin < objects.pack` into it, add the checkout's `objects` directory to
`objects/info/alternates`, then run the script and `git pack-objects` with `GIT_DIR` set to it.
Every object of the previous pack must still be listed.

Lite verification retains implementation commit `41db0c528` for the rebased record assembly, and the earlier Lite and component snapshot reviews remain present.
The sibling bug sweep retains implementation commit `6a64ad413` for the loop siblings command, the bug-fix sibling step, evaluator process reuse and regression proof environments.
Verified artifact retention retains implementation commit `4c5ed1baf` for retention and cancellation beside Lite verification, plus the earlier artifact, cancellation and reconciliation reviews.
Google sign-in retains implementation commit `58700be943` for the native account bridge, the
Hub handoff and device storage changes, and the iOS account adapter.

Hub Home live sessions retains implementation commit `32f91c2f7` for the read-only homeSnapshot device method in the desktop device session and operations services.

The shared verification baseline lint repair retains the reviews of the desktop relay frame check,
project run service and relay host services at the commit that extracted their helpers.

Realtime tracker pushes retain implementation commit `68fcb43a67` for the desktop initializer, preload and local client.

Shared type consolidation retains implementation commit `6c9252a51` for the five moved services whose type references now name the one shared owner.

Home row answers retain the commit that adds the `homeChat` device method to the desktop device session
and operations services; the earlier `homeSnapshot` reviews remain present.

The Harness Vault entry retains implementation commit `baa2b466c` for the phone adapter that
offers the native Vault.

Deferred plan wave 5 retains implementation commit `2d80b045b7` for the moved sources whose operations now name their return and parameter types.

The Wave 5 desktop audit follow-up retains commit `3f638101fe` for the compact source signatures.

The Wave 5 Hub lint follow-up retains commit `269686f1db` for the compact source signatures.

Plan and schedule click-through retains implementation commits `8713ce6311`, `5c2602ebf4` and
`e5d8b2e82c` for the fixed Home read and chat paths through the Mac preload and paired phone.
