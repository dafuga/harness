import type { UserConfig } from 'vite';

/**
 * The config reads SHELL_FIXTURE_PAGE when its module loads, so each case loads it again with its
 * own environment. Only noncatalog pages are invoked: the catalog page runs buildData through bun.
 */
export type ShellConfigModule = { default: () => Promise<UserConfig> };

export type FixtureVariable = 'SHELL_FIXTURE_PAGE' | 'SHELL_FIXTURE_OUT';
