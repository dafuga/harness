/**
 * How far the decision points of one file are known: counted, none to count because the file
 * declares and does not decide, or not counted because nothing here reads its language.
 */
export type ComplexityCoverage = 'counted' | 'declarative' | 'unsupported';
