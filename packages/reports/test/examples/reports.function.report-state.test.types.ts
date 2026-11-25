import type { reportState } from '../../src/repositories/reports-media/report-repository/reportState';

export type BeginInput = Parameters<typeof reportState>[0];

export type Report = ReturnType<typeof reportState>;

export type Status = Report['status'];
