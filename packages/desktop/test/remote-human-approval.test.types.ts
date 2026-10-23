export type Opening = { opened: (...args: unknown[]) => Promise<{ deviceName: string } | null> };
