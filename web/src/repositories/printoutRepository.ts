import type { PrintoutData } from '../models/printout';
import { apiGet, apiPost, apiPatch, apiDelete } from '../lib/api';
import { fromWire, toWire } from '../lib/transform';

type PrintoutWithId = PrintoutData & { id: string };

export const PrintoutRepository = {
  async getVersions(campaignId: string): Promise<PrintoutWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/campaigns/${campaignId}/printouts`);
    return raw.map((r) => fromWire<PrintoutWithId>(r));
  },

  async createVersion(
    campaignId: string,
    data: Omit<PrintoutData, 'version'>,
  ): Promise<string> {
    // Auto-version client-side from the current max (small race; acceptable for v1).
    const existing = await this.getVersions(campaignId);
    const nextVersion = (existing.reduce((max, p) => Math.max(max, p.version), 0)) + 1;
    const wire = toWire<Record<string, unknown>>(data);
    const res = await apiPost<{ id: string }>(`/v1/campaigns/${campaignId}/printouts`, {
      ...wire,
      version: nextVersion,
    });
    return res.id;
  },

  async updateVersion(
    campaignId: string,
    printoutId: string,
    data: Partial<Pick<PrintoutData, 'name' | 'description' | 'fileUrl'>>,
  ): Promise<void> {
    await apiPatch(`/v1/campaigns/${campaignId}/printouts/${printoutId}`, toWire(data));
  },

  async deleteVersion(campaignId: string, printoutId: string): Promise<void> {
    await apiDelete(`/v1/campaigns/${campaignId}/printouts/${printoutId}`);
  },

  async getLatestVersion(campaignId: string): Promise<PrintoutWithId | null> {
    const versions = await this.getVersions(campaignId);
    if (versions.length === 0) return null;
    return versions.reduce((latest, p) => (p.version > latest.version ? p : latest), versions[0]!);
  },
};
