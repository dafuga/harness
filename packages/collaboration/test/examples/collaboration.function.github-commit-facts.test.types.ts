import type { githubCommitFacts } from '../../src/utils/git-source-history/create-git-hub-source/githubCommitFacts';

export type Client = Parameters<typeof githubCommitFacts>[0];

export type Case = { name: string; input: unknown } & ({ output: unknown } | { error: unknown });
