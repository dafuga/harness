

export type PeakMemory = { bytes: number } | { unavailable: string };

export { peakMemory } from '../services/kernel-benchmark-service/peakMemory';
