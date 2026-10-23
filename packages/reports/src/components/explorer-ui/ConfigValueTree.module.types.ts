import type { ConfigValueNode } from '../../../../../src/utils/explorer-ui/unitMetadata';

/** A value that holds others: the attributes of an object or the items of an array. */
export type ConfigCollection = Exclude<ConfigValueNode, { kind: 'expression' }>;
