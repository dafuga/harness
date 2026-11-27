// @harness-uid u_opnwwyftd7
import type { z } from 'zod';
import type { trackerHostWork } from './trackerHostWork';

export type TrackerHostWork = z.infer<typeof trackerHostWork.report>[number];
