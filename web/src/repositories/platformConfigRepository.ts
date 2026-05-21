import type { PlatformConfig } from '../models/platformConfig';
import { apiGet, apiPut } from '../lib/api';
import { fromWire } from '../lib/transform';

export const PlatformConfigRepository = {
  async getConfig(): Promise<PlatformConfig> {
    const raw = await apiGet<{ default_payment_mode: 'direct' | 'platform' }>('/v1/config/platform');
    return fromWire<PlatformConfig>(raw);
  },

  async setDefaultPaymentMode(mode: 'direct' | 'platform'): Promise<void> {
    await apiPut('/v1/config/platform', { default_payment_mode: mode });
  },
};
