import type { prepareProjectRun } from '../../src/services/agents-providers/desktop-run-service/prepareProjectRun';

export type RunContext = Awaited<ReturnType<typeof prepareProjectRun>>;
