import type { renderContract } from '../../src/cli/program/renderContract';
import type { renderUnit } from '../../src/cli/program/renderUnit';
import type { operationRows } from '../../src/cli/program/contractRows';

export type Manifest = Parameters<typeof renderContract>[0];

export type Detail = Parameters<typeof renderUnit>[0];

export type Operations = Parameters<typeof operationRows>[0];
