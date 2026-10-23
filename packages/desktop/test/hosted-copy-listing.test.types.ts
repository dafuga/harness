import type { remoteCacheFixture } from './remote-cache-fixture';

/**
 * The copies the computer keeps of a hosted project for when the hub is away. A snapshot kept
 * before the catalog left route loaders out lists them and says nothing of what an entity owns,
 * so it cannot be corrected here: it is not shown, and the project is away until it is read
 * again. Every other copy, and what a denial does to all of them, stays as it was.
 */
export type Fixture = Awaited<ReturnType<typeof remoteCacheFixture>>;
