import type { createDesktopData } from './desktopData.svelte';

export type DesktopData = ReturnType<typeof createDesktopData>;

export type DesktopCase = (data: DesktopData) => Record<string, unknown>;
