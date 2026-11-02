// @harness-uid u_aqgw2ebixh
import type { z } from 'zod';
import type { browserDiagnosticSchema } from './browserDiagnostics';

export type BrowserDiagnostic = z.infer<typeof browserDiagnosticSchema>;
