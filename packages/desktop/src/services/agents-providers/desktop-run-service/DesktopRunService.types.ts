// @harness-uid u_w56luc7zgc
import type { RunContext } from '../../../models/development-tooling/RunContext.types';
import type { ProjectRunContext } from '../../../utils/agents-providers/prepareProjectRun';
import type { ProjectTaskContext } from '../../../utils/agents-providers/prepareProjectTask';

export type Prepared = RunContext | ProjectRunContext | ProjectTaskContext;
