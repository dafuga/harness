// @harness-uid u_apbouftqys
import type { QaSyncRunInput } from '../../workflows/agents-providers/runQaSync.types';

export type QaSyncCommandOptions = Omit<QaSyncRunInput, 'signal'>;
