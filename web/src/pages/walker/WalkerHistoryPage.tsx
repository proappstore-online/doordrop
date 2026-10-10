import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuthContext } from '../../hooks/useAuthContext';
import { timestampToDate } from '../../utils/timestampToDate';
import { HistoryRecordRepository } from '../../repositories/historyRecordRepository';
import { CampaignRepository } from '../../repositories/campaignRepository';
import type { HistoryRecordData } from '../../models/historyRecord';
import type { CampaignData } from '../../models/campaign';

// ---- Utils ----
const fmtMoney = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'AUD' });
const fmtHM = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;

// Type definition
type WorkItem = HistoryRecordData & { id: string; campaignStatus?: CampaignData['status'] };

// ---------- Detail Dialog ----------
function RecordDetailDialog({
	open, onClose, record,
}: {
	open: boolean;
	onClose: () => void;
	record: WorkItem | null;
}) {
	if (!record || !open) { return null; }

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
				<div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
						Record Details · {timestampToDate(record.date)?.toLocaleDateString() ?? ''}
					</h2>
				</div>
				<div className="p-6 overflow-y-auto">
					<div className="space-y-2 mb-4">
						<h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{record.streetName}</h3>
						<div className="flex gap-2 flex-wrap">
							<span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
								Income: {fmtMoney(record.income)}
							</span>
							<span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
								Doors: {record.doorCount}
							</span>
							<span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
								Duration: {fmtHM(record.durationMin)}
							</span>
						</div>
					</div>
				</div>
				<div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
					<button
						onClick={onClose}
						className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-2 px-4 rounded-lg transition-colors"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}

type CampaignStatusGroup = 'completed' | 'pending-review' | 'paid' | 'disputed' | 'other';

// Map campaign status to history group
function getCampaignStatusGroup(status?: CampaignData['status']): CampaignStatusGroup {
	if (!status) return 'other';
	if (status === 'complete' || status === 'archive') return 'completed';
	if (status === 'review') return 'pending-review';
	if (status === 'payment') return 'paid';
	// Note: Currently no 'disputed' status in campaign model. Could extend this later.
	return 'other';
}

function getStatusLabel(group: CampaignStatusGroup): string {
	switch (group) {
		case 'completed': return 'Completed';
		case 'pending-review': return 'Pending Review';
		case 'paid': return 'Paid';
		case 'disputed': return 'Disputed';
		default: return 'Other';
	}
}

function getStatusColor(group: CampaignStatusGroup): string {
	switch (group) {
		case 'completed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
		case 'pending-review': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
		case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
		case 'disputed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
		default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
	}
}

// ---------- Main Component ----------
const WalkerHistoryPage: React.FC = () => {

	const { currentUser } = useAuthContext();

	const [loading, setLoading] = useState(false);
	const [items, setItems] = useState<WorkItem[]>([]);
	const [selected, setSelected] = useState<WorkItem | null>(null);
	const [open, setOpen] = useState(false);
	const openDetail = (record: WorkItem) => { setSelected(record); setOpen(true); };
	const closeDetail = () => setOpen(false);

	const load = useCallback(async () => {
		if (!currentUser) {
			console.log('User not authenticated yet, skipping fetch');
			return;
		}
		setLoading(true);
		try {
			const res = await HistoryRecordRepository.getHistoryRecordsByWalker(currentUser.id);

			// Fetch campaign details for each record to get status
			const withStatuses: WorkItem[] = await Promise.all(
				res.map(async (r) => {
					try {
						if (r.campaignId) {
							const campaign = await CampaignRepository.getGroup(r.campaignId);
							if (campaign) {
								return { ...r, campaignStatus: campaign.status };
							}
						}
					} catch (err) {
						console.error(`Failed to fetch campaign ${r.campaignId}:`, err);
					}
					return r;
				})
			);

			setItems(withStatuses);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	useEffect(() => { load(); }, [load]);

	// Group items by campaign status
	const groupedItems = useMemo(() => {
		const groups: Record<CampaignStatusGroup, WorkItem[]> = {
			'completed': [],
			'pending-review': [],
			'paid': [],
			'disputed': [],
			'other': [],
		};

		for (const item of items) {
			const group = getCampaignStatusGroup(item.campaignStatus);
			groups[group].push(item);
		}

		// Sort each group by date (newest first)
		for (const group of Object.values(groups)) {
			group.sort((a, b) => (b.date as any) - (a.date as any));
		}

		return groups;
	}, [items]);

	// Calculate totals
	const totals = useMemo(() => {
		return {
			doors: items.reduce((sum, r) => sum + r.doorCount, 0),
			earnings: items.reduce((sum, r) => sum + r.income, 0),
			campaigns: items.length,
		};
	}, [items]);

	return (
		<div className="max-w-5xl mx-auto p-2 md:p-3">
			<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Delivery History</h1>

			{/* Earnings summary */}
			{!loading && items.length > 0 && (
				<div className="grid grid-cols-3 gap-3 mb-6">
					<div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
						<p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Earnings</p>
						<p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(totals.earnings)}</p>
					</div>
					<div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
						<p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Doors Delivered</p>
						<p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totals.doors}</p>
					</div>
					<div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
						<p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Campaigns</p>
						<p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totals.campaigns}</p>
					</div>
				</div>
			)}

			{/* History by status */}
			{loading ? (
				<div className="flex justify-center py-12">
					<div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
				</div>
			) : items.length === 0 ? (
				<div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 text-center">
					<div className="text-4xl mb-3">📋</div>
					<p className="text-gray-600 dark:text-gray-400 mb-4">No delivery history yet.</p>
					<p className="text-sm text-gray-500 dark:text-gray-500">Start delivering campaigns to see your history here.</p>
				</div>
			) : (
				<div className="space-y-6">
					{(['completed', 'pending-review', 'paid', 'disputed'] as CampaignStatusGroup[]).map((statusGroup) => {
						const records = groupedItems[statusGroup];
						if (records.length === 0) return null;

						return (
							<div key={statusGroup}>
								<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
									{getStatusLabel(statusGroup)} ({records.length})
								</h2>
								<div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
									<ul className="divide-y divide-gray-200 dark:divide-gray-700">
										{records.map((record) => (
											<li key={record.id}>
												<button
													onClick={() => openDetail(record)}
													className="w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors p-4 flex items-center justify-between"
													aria-label={`View details for ${record.streetName}`}
												>
													<div className="flex-1">
														<div className="flex items-center gap-3">
															<div className="text-xl">📍</div>
															<div>
																<p className="font-medium text-gray-900 dark:text-gray-100">{record.streetName}</p>
																<p className="text-sm text-gray-600 dark:text-gray-400">
																	{timestampToDate(record.date)?.toLocaleDateString()} • {record.doorCount} doors • {fmtHM(record.durationMin)}
																</p>
															</div>
														</div>
													</div>
													<div className="text-right ml-4">
														<p className="font-semibold text-emerald-600 dark:text-emerald-400 text-lg">{fmtMoney(record.income)}</p>
														<span className={`inline-block mt-1 px-2.5 py-0.5 rounded text-xs font-medium ${getStatusColor(statusGroup)}`}>
															{getStatusLabel(statusGroup)}
														</span>
													</div>
												</button>
											</li>
										))}
									</ul>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Detail dialog */}
			<RecordDetailDialog open={open} onClose={closeDetail} record={selected} />
		</div>
	);
};

export default WalkerHistoryPage;
