/**
 * The model and effort pickers are two lists of choices behind one modal dialog. The dialog is
 * owned once, wherever it lives and whatever it is called: it is found through the imports the
 * two pickers really write. What nothing uses is gone: no composer row style without markup, and
 * HubView, mounted by nothing, is retired with its history kept and no legacy redirect changed.
 */
export type AstNode = Record<string, unknown>;

export type Unit = { id: string; status: string; owns: { source: string[] } };
