export type HistoryRecordStatus = 'completed' | 'failed';

export type HistoryRecordData = {

  walkerId: string;
  date: Date;
  streetName: string;
  income: number;
  doorCount: number;
  durationMin: number;
};
