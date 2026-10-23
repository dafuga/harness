import type { githubFixture } from './githubFixture';

export type GithubFixture = Awaited<ReturnType<typeof githubFixture>>;
