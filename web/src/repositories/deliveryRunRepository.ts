import type { DeliveryRunData } from '../models/deliveryRun';

type DeliveryRunWithId = DeliveryRunData & { id: string };

// TODO: Worker endpoints for delivery_runs aren't built yet (the table exists in
// migrations/0001_init.sql but no /v1/campaigns/:id/schedules routes). Methods
// here throw until those are added; pages that depend on schedules will surface
// the gap. Plan: add `routes/schedules.ts` to worker/src/routes/ when porting
// the schedule-using pages (WalkerDeliveryPage, ClientCampaignDetailPage).
export const DeliveryRunRepository = {
  async getSchedule(_id: string): Promise<DeliveryRunWithId | null> {
    throw new Error('DeliveryRunRepository.getSchedule: not yet implemented in worker');
  },

  async createSchedule(_data: DeliveryRunData, _campaignId: string): Promise<string> {
    throw new Error('DeliveryRunRepository.createSchedule: not yet implemented in worker');
  },

  async getSchedulesByCampaign(_campaignId: string): Promise<DeliveryRunWithId[]> {
    throw new Error('DeliveryRunRepository.getSchedulesByCampaign: not yet implemented in worker');
  },
};
