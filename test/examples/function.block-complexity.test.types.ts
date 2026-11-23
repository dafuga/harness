import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * Each public operation is called the way its callers call it: blockComplexity with masked source
 * and a function base, templateComplexity with Svelte markup. What each call was given and what it
 * returned is asserted and recorded as the cases of its state.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

export type MaskedSource = { masked: string; base: 0 | 1 };

export type TemplateMarkup = { markup: string };
