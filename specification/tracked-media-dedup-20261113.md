# Tracked PNG duplicate inventory

Read-only inventory at commit `32a4c43f9e7f6a9ed22d48cbe7f805f2b0b3f5db` (2026-11-13). This lists tracked PNG paths from the committed Git tree. No assets were removed or rewritten.

## Totals

- 24 PNG paths represent 12 unique content IDs and 32,926,539 logical content bytes (about 31.4 MiB).
- 11 content IDs have repeated paths: ten pairs of Git LFS assets and one three-path splash asset. Those 23 paths account for 32,919,087 logical bytes; replacing repeated paths with references could save about 16,480,180 bytes in an expanded checkout, if all callers and packaging rules allowed it.
- Git has 12 distinct blob IDs for these 24 paths. The 20 LFS pointer paths resolve to 10 unique LFS SHA-256 OIDs; each pointer is a 132-byte Git blob. The three identical splash paths share one 41,273-byte Git blob. These identities mean Git stores one blob object for each unique Git blob ID, not one object per path. The inventory does not claim a packed `.git` size: pack compression and repo-wide object reachability affect that value.
- Logical LFS content size is counted from each committed pointer's `size` line. Remote LFS storage and present-day expanded working-tree allocation were not measured.

## Duplicate content IDs

Each row gives content SHA, logical bytes, Git blob ID, and repeated paths. For LFS assets, content SHA is the LFS SHA-256 OID and the Git blob ID is the pointer object. For the splash image, content SHA and Git blob ID are the Git SHA-1 blob ID.

| Content SHA | Bytes | Git blob ID | Paths |
|---|---:|---|---|
| `b27d16c777216097e6863f3e6c37f402c46b70d9837d412991c5fbb4db079fab` | 1,774,191 | `31142bb1780e241f2e6c46d8c842b7a37b4763c8` | `specification/designs/harness-image-threads/pages/catalog/designs/v002/desktop.png`; `src/pages/harness-workspace/designs/v002/catalog-desktop.png` |
| `8ebcabc8186bec6c46f5a1ea26c343b8b849c1ae1c984207279fb08becfb04c4` | 1,712,240 | `98d1fe307993a635c2458e684c9e93f2e168ae59` | `specification/designs/harness-image-threads/pages/approved-designs/designs/v002/desktop.png`; `src/pages/harness-workspace/designs/v002/approved-desktop.png` |
| `b2d075c77b8983544f0a0933db567a2eb7d082c3c98b2b6f8879c04700533536` | 1,703,247 | `f31ed1af00062f30a4dfd2437a05bddf6d4924b7` | `specification/designs/harness-image-threads/pages/approved-designs/designs/v001/desktop.png`; `src/pages/harness-workspace/designs/v001/approved-desktop.png` |
| `924ec543b56d202e6183d5ff56aee70bc827bb279284c06562c6066d0a2566d7` | 1,682,722 | `e9393cae4a26b64b9b11b8c7156e87301445d98b` | `specification/designs/harness-image-threads/pages/catalog/designs/v001/desktop.png`; `src/pages/harness-workspace/designs/v001/catalog-desktop.png` |
| `d53a291371de30802c76f504da9c6081717da1e6dcb9a4c991fc68c390eaa00c` | 1,637,700 | `a051288e4281f13a0f3f2a8ef3ea649e18745cd8` | `specification/designs/harness-image-threads/components/activity-feed/designs/v001/desktop.png`; `src/pages/harness-workspace/designs/v001/component-desktop.png` |
| `eba5af34c8dfa31894fb258c6155a13eb6492f62e1e2ff1215cf3f40b61298d5` | 1,600,152 | `b8c3d84832a11e60b734c326003422e6c2e4bb23` | `specification/designs/harness-image-threads/pages/design-review/designs/v001/desktop.png`; `src/pages/harness-workspace/designs/v001/review-desktop.png` |
| `09412e5f81f5c08a813277538c11e4d96f47fdee795e24a6c497240734e704f8` | 1,599,853 | `c544210e245e5029f36eef483a478fc16cdeb2e6` | `specification/designs/harness-image-threads/pages/design-review/designs/v002/desktop.png`; `src/pages/harness-workspace/designs/v002/review-desktop.png` |
| `4016d2ac311faa5f7a66783f09e99b21a417cf193831d1dbf02e15605b630450` | 1,589,608 | `010b6f1709398c7ed7db3f930cbff8efdbb4de5a` | `specification/designs/harness-image-threads/components/activity-feed/designs/v002/desktop.png`; `src/pages/harness-workspace/designs/v002/component-desktop.png` |
| `ee12758a42b9bc86ea6914f5627debf1c208087f8550fae7e8658c1df1b0edbe` | 1,583,702 | `77572ac258948bd203ee057bc19b3ebbd3080758` | `specification/designs/harness-image-threads/pages/activity/designs/v002/desktop.png`; `src/pages/harness-workspace/designs/v002/entity-desktop.png` |
| `b8af46749c665988d2ad62f1e7be667bfdb7adb2b5c2cd515dad528b37c8d352` | 1,514,219 | `ad449fff0dc93f4a51270e8e4e8982177e67068b` | `specification/designs/harness-image-threads/pages/activity/designs/v001/desktop.png`; `src/pages/harness-workspace/designs/v001/entity-desktop.png` |
| `33ea6c970f2df1db62a624a55e5bbcc4ee07bbdf` | 41,273 | `33ea6c970f2df1db62a624a55e5bbcc4ee07bbdf` | `packages/desktop/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png`; `packages/desktop/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png`; `packages/desktop/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png` |

The remaining PNG is the unique 7,452-byte `packages/desktop/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` blob (`4a840857566cfe5add1efbab7b5737f21ebfcc0e`). Three tracked `favicon.svg` paths also share Git blob `ca882326061c0280987530b0e08e9532f7cd00a3` (415 bytes); SVG is outside the PNG totals above.

This inventory does not establish that duplicate paths are interchangeable. No asset cleanup or root `AGENTS.md` split was attempted; any cleanup needs path-reference and packaging-guard review first.
