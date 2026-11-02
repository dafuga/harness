// @harness-uid u_aqokuxsnj3
import type { ConfigValueNode } from '../../../../../src/utils/explorer-ui/unitMetadata';
import type { HarnessIconName } from '../../utils/explorer-ui/harnessIcons';

/** A value that holds others: the attributes of an object or the items of an array. */
export type ConfigCollection = Exclude<ConfigValueNode, { kind: 'expression' }>;

/** The icon and source-size label shown for a value that deserves inspection. */
export type ConfigValueMark = { icon: HarnessIconName; size: string };
