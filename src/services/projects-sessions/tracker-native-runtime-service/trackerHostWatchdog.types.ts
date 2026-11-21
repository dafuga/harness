// @harness-uid u_bl6xl2h4a3
import type { z } from 'zod';
import type { trackerWatchdogAlerts } from './trackerHostWatchdogSchema';

export type TrackerWatchdogAlerts = z.infer<typeof trackerWatchdogAlerts>;
export type TrackerWatchdogAlert = TrackerWatchdogAlerts[string];
