import type { Command } from 'commander';

export type ProgramSummary = { name: string; version: string | null; commands: string[] };

export type ErrorSummary = { name: string; message: string };

export type Loader = (program: Command) => Promise<void>;
