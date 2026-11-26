import type { githubGraphql } from '../../src/utils/git-source-history/create-git-hub-source/githubGraphql';

export type Options = Parameters<typeof githubGraphql>[0];

export type Fetch = NonNullable<Options['fetch']>;
