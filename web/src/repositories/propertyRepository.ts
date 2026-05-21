import type { PropertyData, PropertyReport } from '../models/property';
import { apiGet, apiPost, apiPatch, ApiError } from '../lib/api';
import { fromWire, toWire } from '../lib/transform';
import { pas } from '../services/pas';

type PropertyWithId = PropertyData & { id: string };

// Deterministic id, matches the worker's propertyId() helper. Kept identical
// to the original DoorDrop function so cross-source lookups by id still work.
export function propertyDocId(address: string, suburb: string, postcode: string): string {
  return `${address}|${suburb}|${postcode}`.toLowerCase().replace(/[/\\.\s]+/g, '_');
}

export const PropertyRepository = {
  async getProperties(userId: string): Promise<PropertyWithId[]> {
    const raw = await apiGet<unknown[]>(`/v1/properties?userId=${encodeURIComponent(userId)}`);
    return raw.map((r) => fromWire<PropertyWithId>(r));
  },

  async getProperty(propertyId: string): Promise<PropertyWithId | null> {
    try {
      const raw = await apiGet(`/v1/properties/${encodeURIComponent(propertyId)}`);
      return fromWire<PropertyWithId>(raw);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  async addProperty(_userId: string, data: PropertyData): Promise<string> {
    // Worker derives id deterministically and merges access_user_ids with the caller.
    const res = await apiPost<{ id: string }>('/v1/properties', toWire(data));
    return res.id;
  },

  async addProperties(userId: string, properties: PropertyData[]): Promise<void> {
    for (const prop of properties) {
      await this.addProperty(userId, prop);
    }
  },

  async findByAddress(
    address: string,
    suburb: string,
    postcode: string,
  ): Promise<PropertyWithId | null> {
    return this.getProperty(propertyDocId(address, suburb, postcode));
  },

  async addReport(propertyId: string, report: PropertyReport): Promise<string> {
    const res = await apiPost<{ id: string }>(
      `/v1/properties/${encodeURIComponent(propertyId)}/reports`,
      toWire(report),
    );
    return res.id;
  },

  async getReports(propertyId: string): Promise<(PropertyReport & { id: string })[]> {
    const raw = await apiGet<unknown[]>(
      `/v1/properties/${encodeURIComponent(propertyId)}/reports`,
    );
    return raw.map((r) => fromWire<PropertyReport & { id: string }>(r));
  },

  async uploadPropertyPhoto(propertyId: string, file: File): Promise<string> {
    // Ported from Firebase Storage to @proappstore/sdk's public R2 upload —
    // returns a long-lived public URL safe for <img src>.
    const path = `properties/${propertyId}/${Date.now()}.jpg`;
    const result = await pas.storage.uploadPublic(path, file, file.type);
    return result.url;
  },

  async addAccessUser(propertyId: string, userId: string): Promise<void> {
    const prop = await this.getProperty(propertyId);
    if (!prop) throw new Error('property not found');
    const ids = prop.accessUserIds.includes(userId)
      ? prop.accessUserIds
      : [...prop.accessUserIds, userId];
    await apiPatch(`/v1/properties/${encodeURIComponent(propertyId)}`, {
      access_user_ids: ids,
    });
  },
};
