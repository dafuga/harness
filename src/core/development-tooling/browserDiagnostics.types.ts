import type { z } from 'zod';
import type { browserDiagnosticSchema } from './browserDiagnostics';

export type BrowserDiagnostic = z.infer<typeof browserDiagnosticSchema>;
