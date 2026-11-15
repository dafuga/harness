// @harness-uid u_qz7bs2ymbn
import type { ConsolePolicy } from './consolePolicy.types';

/** The default for any host that has not supplied a policy. */
export const denyAll: ConsolePolicy = () => false;

export {
	loopbackAddress,
	consolePolicy
} from '../../../packages/reports/src/utils/explorer-ui/console-server/consolePolicy';

export type { ConsoleRequest, ConsolePolicy, OwnerMode } from './consolePolicy.types';
