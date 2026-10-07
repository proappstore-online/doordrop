import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CampaignData, HistoryRecordData, UserWithId, WalkerReview } from '../../models';
import { UserRepository } from '../../repositories/userRepository';
import { CampaignRepository } from '../../repositories/campaignRepository';
import { WalkerReviewRepository } from '../../repositories/walkerReviewRepository';
import { HistoryRecordRepository } from '../../repositories/historyRecordRepository';
import { Field, MiniStat, RoleBadge, Spinner, StatusBadge } from './adminUi';

type CampaignRow = CampaignData & { id: string };
type ReviewRow = WalkerReview & { id: string };
type HistoryRow = HistoryRecordData & { id: string };

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<UserWithId | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const u = await UserRepository.getUser(userId);
        setUser(u);
        if (u?.role === 'client') {
          setCampaigns(await CampaignRepository.getCampaignsByUser(userId));
        } else if (u?.role === 'walker') {
          const [camps, revs, hist] = await Promise.all([
            CampaignRepository.getCampaignsByAssignedWalker(userId),
            WalkerReviewRepository.getReviewsForWalker(userId, 10),
            HistoryRecordRepository.getHistoryRecordsByWalker(userId),
          ]);
          setCampaigns(camps);
          setReviews(revs.reviews);
          setHistory(hist.slice(0, 20));
        }
      } catch (err) {
        console.error('Failed to load user detail:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) return <Spinner />;

  if (!user) {
    return (
      <div className="py-8">
        <p className="text-slate-500">User not found.</p>
        <Link to="/admin/users" className="text-emerald-600 hover:underline mt-2 inline-block">Back to users</Link>
      </div>
    );
  }

  const average = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const cp = user.clientProfile;
  const wp = user.walkerProfile;

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/admin/users" className="text-sm text-emerald-600 hover:underline">&larr; Back to users</Link>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden flex-shrink-0">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-emerald-600">{user.name?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{user.name}</h1>
            <p className="text-slate-500 text-sm">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <RoleBadge role={user.role} />
              {user.createdAt && (
                <span className="text-xs text-slate-400">Joined {user.createdAt.toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {user.role === 'client' && cp && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Business Info</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {cp.businessName && <Field label="Business" value={cp.businessName} />}
            {cp.tradingName && <Field label="Trading As" value={cp.tradingName} />}
            {cp.abn && <Field label="ABN" value={cp.abn} />}
            {cp.industry && <Field label="Industry" value={cp.industry} />}
            <Field label="Contact" value={`${cp.contactFirstName} ${cp.contactLastName}`} />
            <Field label="Phone" value={cp.contactPhone} />
            <Field label="Email" value={cp.contactEmail} />
            {cp.suburb && <Field label="Location" value={`${cp.suburb} ${cp.state} ${cp.postcode}`} />}
          </dl>
        </div>
      )}

      {user.role === 'walker' && wp && (
        <>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Walker Profile</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {wp.ratePerDoor != null && <Field label="Rate / Door" value={`$${wp.ratePerDoor}`} />}
              <Field label="Service Radius" value={`${wp.serviceRadiusKm} km`} />
              {wp.availableDays && <Field label="Available" value={wp.availableDays.join(', ')} />}
              {wp.maxDoorsPerDay != null && <Field label="Max Doors/Day" value={String(wp.maxDoorsPerDay)} />}
              {wp.hasVehicle && <Field label="Vehicle" value={wp.vehicleType || 'Yes'} />}
              {wp.hasABN && <Field label="ABN" value={wp.abn || 'Yes'} />}
            </dl>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniStat label="Campaigns" value={wp.totalCampaignsCompleted ?? 0} />
            <MiniStat label="Doors Delivered" value={wp.totalDoorsDelivered ?? 0} />
            <MiniStat label="Km Walked" value={Number(wp.totalKmWalked ?? 0).toFixed(1)} />
            <MiniStat label="Minutes" value={wp.totalMinutesSpent ?? 0} />
          </div>
        </>
      )}

      {user.role === 'walker' && reviews.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Reviews ({reviews.length}) — {average.toFixed(1)} avg
          </h2>
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-slate-100 pb-3 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500">
                    {'★'.repeat(Math.round(r.rating))}{'☆'.repeat(5 - Math.round(r.rating))}
                  </span>
                  <span className="text-xs text-slate-400">
                    {r.reviewerName || 'Anonymous'}
                    {r.createdAt && ` — ${r.createdAt.toLocaleDateString()}`}
                  </span>
                </div>
                {r.comment && <p className="text-sm text-slate-500 mt-1">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {user.role === 'client' ? 'Their Campaigns' : 'Assigned Campaigns'} ({campaigns.length})
          </h2>
          <div className="space-y-2">
            {campaigns.map((c) => (
              <Link
                key={c.id}
                to={`/admin/campaigns/${c.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors no-underline"
              >
                <div>
                  <span className="font-medium text-slate-900">{c.name}</span>
                  <span className="text-sm text-slate-500 ml-2">{c.suburb} {c.postcode}</span>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Deliveries</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Street</th>
                  <th className="pb-2">Doors</th>
                  <th className="pb-2">Duration</th>
                  <th className="pb-2">Income</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2 text-slate-900">{h.date ? h.date.toLocaleDateString() : '—'}</td>
                    <td className="py-2 text-slate-600">{h.streetName}</td>
                    <td className="py-2 text-slate-900">{h.doorCount}</td>
                    <td className="py-2 text-slate-600">{h.durationMin} min</td>
                    <td className="py-2 text-slate-900">${(h.income ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
