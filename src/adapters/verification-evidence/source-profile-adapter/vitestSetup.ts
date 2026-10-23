import { afterAll } from 'vitest';
import { flushSourceProfiles } from './profileRuntime';

// Flush before a worker can be reused or terminated; exit remains a fallback for Bun commands.
afterAll(flushSourceProfiles);
