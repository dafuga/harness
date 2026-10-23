import type ts from 'typescript';

// A declared contract is required. This conservative guard rejects unsupported operations;
// it is not a general proof of purity for arbitrary JavaScript or hostile input objects.
export type Callable = ts.FunctionDeclaration | ts.VariableStatement;
