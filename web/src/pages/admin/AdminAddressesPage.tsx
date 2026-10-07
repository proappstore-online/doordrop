import { useEffect, useMemo, useState } from 'react';
import { AdminRepository, type AdminDoor } from '../../repositories/adminRepository';
import { Spinner } from './adminUi';

const selectClass = 'w-full px-3 py-2 border rounded-md bg-white text-gray-900 border-gray-300';

export default function AdminAddressesPage() {
  const [doors, setDoors] = useState<AdminDoor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSuburb, setFilterSuburb] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'delivered' | 'reported'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'address'>('recent');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    AdminRepository.getAllDoors()
      .then(setDoors)
      .catch((err) => console.error('Failed to load addresses:', err))
      .finally(() => setLoading(false));
  }, []);

  const suburbs = useMemo(
    () => Array.from(new Set(doors.map((d) => d.suburb).filter(Boolean) as string[])).sort(),
    [doors],
  );

  const campaigns = useMemo(() => {
    const unique = new Map<string, string>();
    doors.forEach((d) => unique.set(d.campaignId, d.campaignName || 'Unnamed Campaign'));
    return Array.from(unique.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [doors]);

  const filtered = useMemo(() => {
    const result = doors.filter(
      (d) =>
        (!filterSuburb || d.suburb === filterSuburb) &&
        (!filterCampaign || d.campaignId === filterCampaign) &&
        (filterStatus === 'all' || d.status === filterStatus),
    );
    return sortBy === 'recent'
      ? result.sort((a, b) => (b.deliveredAt?.getTime() ?? 0) - (a.deliveredAt?.getTime() ?? 0))
      : result.sort((a, b) => (a.address || '').localeCompare(b.address || ''));
  }, [doors, filterSuburb, filterCampaign, filterStatus, sortBy]);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">All Addresses</h1>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="block text-sm font-medium text-gray-700">
            Suburb
            <select value={filterSuburb} onChange={(e) => setFilterSuburb(e.target.value)} className={`${selectClass} mt-1`}>
              <option value="">All suburbs</option>
              {suburbs.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Campaign
            <select value={filterCampaign} onChange={(e) => setFilterCampaign(e.target.value)} className={`${selectClass} mt-1`}>
              <option value="">All campaigns</option>
              {campaigns.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Status
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} className={`${selectClass} mt-1`}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="delivered">Delivered</option>
              <option value="reported">Reported</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Sort by
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className={`${selectClass} mt-1`}>
              <option value="recent">Most recently visited</option>
              <option value="address">Address (A-Z)</option>
            </select>
          </label>
        </div>
        <div className="text-sm text-gray-600">Showing {filtered.length} of {doors.length} addresses</div>
      </div>

      <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200 text-gray-900">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No addresses found matching your filters.</div>
        ) : (
          filtered.map((door) => {
            const key = `${door.campaignId}-${door.id}`;
            const open = expandedKey === key;
            return (
              <div key={key} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedKey(open ? null : key)}>
                  <div className="flex-1">
                    <div className="font-medium">{door.address}</div>
                    <div className="text-sm text-gray-500 space-x-2">
                      <span>{door.suburb || 'Unknown suburb'}</span>
                      <span>•</span>
                      <span>{door.campaignName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        door.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : door.status === 'reported'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {door.status}
                    </span>
                    <span className="text-xs text-gray-500">{door.deliveryCount || 0}x delivered</span>
                    <span className="text-gray-400">{open ? '▴' : '▾'}</span>
                  </div>
                </div>

                {open && (
                  <div className="mt-4 pl-4 border-l-2 border-gray-200 space-y-3">
                    <div className="text-sm text-gray-600 space-y-0.5">
                      <div>Campaign: {door.campaignName}</div>
                      <div>Suburb: {door.suburb || 'N/A'}</div>
                      <div>Total deliveries: {door.deliveryCount || 0}</div>
                      {door.deliveredAt && <div>Last visited: {door.deliveredAt.toLocaleString()}</div>}
                    </div>
                    {door.history && door.history.length > 0 && (
                      <div>
                        <div className="text-sm font-semibold text-gray-700 mb-1">Delivery History ({door.history.length})</div>
                        <div className="space-y-1">
                          {door.history.map((event, idx) => (
                            <div key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                              <div>
                                <div className="font-medium">{new Date(event.date).toLocaleString()}</div>
                                {event.printoutVersionId && <div className="text-xs text-gray-500">Version: {event.printoutVersionId}</div>}
                                {event.notes && <div className="text-xs text-gray-500">{event.notes}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
