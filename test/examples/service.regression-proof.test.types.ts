import type { focusedScreens } from '../../src/workflows/verification-evidence/record-regression/focusedScreens';

export type Gathered = Parameters<typeof focusedScreens>[0][number];

export type Scenario = Parameters<typeof focusedScreens>[2]['scenarios'][number];
