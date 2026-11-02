// @harness-uid u_dr2xl6z3dy
import type ts from 'typescript';
import type { ConfigValueNode } from '../../../utils/explorer-ui/unitMetadata';

export type Bindings = Map<string, ts.Expression>;

export type CollectionNode = Extract<ConfigValueNode, { kind: 'object' | 'array' }>;
