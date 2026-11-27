import type { focusOn } from '../../src/components/explorer-ui/harness-map/focusView';

export type Layout = Parameters<typeof focusOn>[0];

export type Edges = Layout['edges'];

export type Unit = Layout['nodes'][number]['unit'];
