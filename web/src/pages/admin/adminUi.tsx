import { NavLink } from 'react-router-dom';

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  walker: 'bg-amber-100 text-amber-700',
  client: 'bg-blue-100 text-blue-700',
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ROLE_COLORS[role] || 'bg-slate-100 text-slate-700'}`}>
      {role}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  ready: 'bg-emerald-100 text-emerald-700',
  assigned: 'bg-blue-100 text-blue-700',
  complete: 'bg-indigo-100 text-indigo-700',
  review: 'bg-yellow-100 text-yellow-700',
  payment: 'bg-purple-100 text-purple-700',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-900 font-medium">{value}</dd>
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 text-center">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

const LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/campaigns', label: 'Campaigns' },
  { to: '/admin/addresses', label: 'Addresses' },
];

export function AdminNav() {
  return (
    <nav className="flex gap-4 text-sm mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => (isActive ? 'font-semibold text-emerald-600' : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600')}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
