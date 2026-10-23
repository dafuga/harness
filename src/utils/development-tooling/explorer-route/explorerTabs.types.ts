import type { explorerCategories, explorerTabs } from './explorerTabs';

export type ExplorerCategory = (typeof explorerCategories)[number];

export type ExplorerTab = (typeof explorerTabs)[keyof typeof explorerTabs][number];
