import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';
const home = mkdtempSync(join(tmpdir(), 'harness-tests-analytics-'));
process.env.HARNESS_ANALYTICS_HOME = home;
process.env.PROJECT_REPORTS_HOME = join(home, 'reports');
process.env.PROJECT_REPORTS_ASSET_STORAGE = 'local';
afterAll(() => rmSync(home, { recursive: true, force: true }));
