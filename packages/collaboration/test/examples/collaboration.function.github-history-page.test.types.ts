import type { githubHistoryPage } from '../../src/utils/git-source-history/create-git-hub-source/githubHistoryPage';

export type Context = Parameters<typeof githubHistoryPage>[0];

export type Repository = Parameters<typeof githubHistoryPage>[1];

export type FakeResponse = { data: unknown; hasNext: boolean };
