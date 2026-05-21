import type { HistoryRecordData } from '../models/historyRecord';
import { apiGet } from '../lib/api';
import { fromWire } from '../lib/transform';

type HistoryWithId = HistoryRecordData & { id: string };

export const HistoryRecordRepository = {
  async getHistoryRecords(): Promise<HistoryWithId[]> {
    const raw = await apiGet<unknown[]>('/v1/history');
    return raw.map((r) => fromWire<HistoryWithId>(r));
  },

  async getHistoryRecordsByWalker(
    walkerId: string,
    _maxResults = 20,
  ): Promise<HistoryWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/history?walkerId=${encodeURIComponent(walkerId)}`);
    return raw.map((r) => fromWire<HistoryWithId>(r));
  },
};
