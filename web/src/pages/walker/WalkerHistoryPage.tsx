import React from 'react';
import { useAuthContext } from '../../hooks/useAuthContext';
import { timestampToDate } from '../../utils/timestampToDate';
import { HistoryRecordRepository } from '../../repositories/historyRecordRepository';
import type { HistoryRecordData } from '../../models/historyRecord';

// ---- Utils ----
const fmtMoney = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'AUD' });
const fmtHM = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;

// ---------- Detail Dialog ----------
type WorkItem = HistoryRecordData & { id: string };

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

// ---------- Main Component ----------
const WalkerHistoryPage: React.FC = () => {

	const { currentUser } = useAuthContext();

	const [loading, setLoading] = React.useState(false);
	const [items, setItems] = React.useState<WorkItem[]>([]);
	const [selected, setSelected] = React.useState<WorkItem | null>(null);
	const [open, setOpen] = React.useState(false);
	const openDetail = (record: WorkItem) => { setSelected(record); setOpen(true); };
	const closeDetail = () => setOpen(false);

	const load = React.useCallback(async () => {
		if (!currentUser) {
			console.log('User not authenticated yet, skipping fetch');
			return;
		}
		setLoading(true);
		try {
			const res = await HistoryRecordRepository.getHistoryRecordsByWalker(currentUser.id);
			setItems(res);
		} finally {
			setLoading(false);
		}
	}, [currentUser]);

	React.useEffect(() => { load(); }, [load]);

	return (
		<div className="max-w-5xl mx-auto p-2 md:p-3">
			<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Past</h1>

			{/* List view */}
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
				{loading ? (
					<div className="flex justify-center py-6">
						<div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
					</div>
				) : items.length === 0 ? (
					<div className="p-6">
						<p className="text-gray-600 dark:text-gray-400">No records.</p>
					</div>
				) : (
					<ul>
						{items.map((record, idx) => (
							<li key={record.id}>
								<button
									onClick={() => openDetail(record)}
									className="w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
								>
									<div className="flex items-center p-4">
										<div className="flex-shrink-0">
											<div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center">
												<svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
												</svg>
											</div>
										</div>
										<div className="ml-4 flex-1">
											<div className="text-base font-medium text-gray-900 dark:text-gray-100">
												{record.streetName}
											</div>
											<div className="mt-1">
												<span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
													{timestampToDate(record.date)?.toLocaleDateString() ?? ''}
												</span>
											</div>
										</div>
										<div className="ml-4 text-right">
											<div className="text-lg font-medium text-gray-900 dark:text-gray-100">{fmtMoney(record.income)}</div>
										</div>
									</div>
								</button>
								{idx < items.length - 1 && <div className="border-t border-gray-200 dark:border-gray-700" />}
							</li>
						))}
					</ul>
				)}
			</div>

			{/* Detail dialog */}
			<RecordDetailDialog open={open} onClose={closeDetail} record={selected} />
		</div>
	);
};

export default WalkerHistoryPage;
