import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import type { CampaignData, CampaignStatus, DoorData } from '../../models';
import { CampaignRepository } from '../../repositories/campaignRepository';
import { DoorRepository } from '../../repositories/doorRepository';
import { AdminRepository, type JobStatus } from '../../repositories/adminRepository';
import { Spinner } from './adminUi';

type CampaignRow = CampaignData & { id: string };
type DoorRow = DoorData & { id: string };

const STATUSES: CampaignStatus[] = ['draft', 'ready', 'assigned', 'complete', 'review', 'payment', 'archive'];
const JOB_STATUSES: { value: JobStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export default function AdminCampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [doors, setDoors] = useState<DoorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    (async () => {
      try {
        setCampaign(await CampaignRepository.getGroup(campaignId));
        setDoors(await DoorRepository.getDoorsByCampaign(campaignId));
      } catch (err) {
        console.error('Failed to load campaign:', err);
        toast.error('Failed to load campaign data');
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId]);

  const update = async (change: { status?: CampaignStatus; job_status?: JobStatus }) => {
    if (!campaignId) return;
    setUpdating(true);
    try {
      await AdminRepository.setCampaignStatus(campaignId, change);
      setCampaign((prev) =>
        prev ? { ...prev, ...(change.status && { status: change.status }), ...(change.job_status && { jobStatus: change.job_status }) } : prev,
      );
      toast.success('Campaign updated');
    } catch (err) {
      toast.error(`Failed to update campaign: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return <Spinner />;
  if (!campaign) return <p className="text-slate-500">Campaign not found.</p>;

  const deliveredCount = doors.filter((d) => d.status === 'delivered').length;
  const doorsByStreet: Record<string, DoorRow[]> = {};
  doors.forEach((door) => {
    (doorsByStreet[door.streetName] ??= []).push(door);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/admin/campaigns" className="hover:text-emerald-600">Campaigns</Link>
        <span>/</span>
        <span>{campaign.name}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{campaign.name}</h1>
            <p className="text-slate-500">{campaign.suburb} {campaign.postcode} &middot; {campaign.state}</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="text-right">
              <label className="block text-xs text-slate-500 mb-0.5">Campaign Status</label>
              <select
                value={campaign.status || 'draft'}
                onChange={(e) => update({ status: e.target.value as CampaignStatus })}
                disabled={updating}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 disabled:opacity-50"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <label className="block text-xs text-slate-500 mb-0.5">Job Status</label>
              <select
                value={campaign.jobStatus || 'draft'}
                onChange={(e) => update({ job_status: e.target.value as JobStatus })}
                disabled={updating}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 disabled:opacity-50"
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {campaign.assignedWalkerId && (
          <p className="text-sm text-slate-500 mt-2">
            <strong>Assigned Walker:</strong>{' '}
            <Link to={`/admin/users/${encodeURIComponent(campaign.assignedWalkerId)}`} className="text-emerald-700 hover:underline">
              {campaign.assignedWalkerId}
            </Link>
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-xs text-slate-500">Doors</p>
            <p className="text-xl font-semibold text-slate-900">{doors.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Delivered</p>
            <p className="text-xl font-semibold text-emerald-600">{deliveredCount}/{doors.length}</p>
          </div>
          {campaign.budget != null && (
            <div>
              <p className="text-xs text-slate-500">Budget</p>
              <p className="text-xl font-semibold text-slate-900">${campaign.budget}</p>
            </div>
          )}
          {campaign.dueDate && (
            <div>
              <p className="text-xs text-slate-500">Due Date</p>
              <p className="text-xl font-semibold text-slate-900">{campaign.dueDate.toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <h2 className="text-lg font-semibold text-slate-900 p-4 border-b border-slate-100">Doors by Street</h2>
        {Object.entries(doorsByStreet).map(([street, streetDoors]) => (
          <div key={street}>
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
              <span className="text-sm font-medium text-slate-900">{street} ({streetDoors.length})</span>
              <span className="text-xs text-emerald-600">
                {streetDoors.filter((d) => d.status === 'delivered').length}/{streetDoors.length} delivered
              </span>
            </div>
            {streetDoors.map((door) => (
              <div key={door.id} className="flex items-center justify-between px-4 py-2 pl-8 text-sm border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-slate-700">{door.houseNumber}</span>
                  {(door.deliveryCount || 0) > 0 && <span className="text-xs text-slate-400">{door.deliveryCount}x</span>}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    door.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {door.status}
                </span>
              </div>
            ))}
          </div>
        ))}
        {doors.length === 0 && <p className="text-center text-slate-500 py-6">No doors.</p>}
      </div>
    </div>
  );
}
