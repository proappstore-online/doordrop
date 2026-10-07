import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminRepository, type AdminStats } from '../../repositories/adminRepository';
import { Spinner } from './adminUi';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({ users: 0, campaigns: 0, walkers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AdminRepository.getStats()
      .then(setStats)
      .catch((err) => console.error('Failed to load stats:', err))
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Total Users', value: stats.users, to: '/admin/users', color: 'bg-blue-500' },
    { label: 'Campaigns', value: stats.campaigns, to: '/admin/campaigns', color: 'bg-emerald-500' },
    { label: 'Walkers', value: stats.walkers, to: '/admin/users?role=walker', color: 'bg-amber-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {cards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="block p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow no-underline"
            >
              <p className="text-sm text-slate-500">{card.label}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{card.value}</p>
              <div className={`h-1 w-12 ${card.color} rounded mt-3`} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
