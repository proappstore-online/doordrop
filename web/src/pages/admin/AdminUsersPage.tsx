import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import type { UserWithId } from '../../models';
import { AdminRepository } from '../../repositories/adminRepository';
import { RoleBadge, Spinner } from './adminUi';

type Role = UserWithId['role'];
type Filter = 'all' | Role;

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const filter: Filter = roleParam === 'client' || roleParam === 'walker' || roleParam === 'admin' ? roleParam : 'all';

  const [users, setUsers] = useState<UserWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    AdminRepository.getAllUsers()
      .then((all) => setUsers([...all].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))))
      .catch((err) => {
        console.error('Failed to load users:', err);
        toast.error('Failed to load users');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdatingId(userId);
    try {
      await AdminRepository.setUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      toast.error(`Failed to update role: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = filter === 'all' ? users : users.filter((u) => u.role === filter);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Users ({filtered.length})</h1>
        <div className="flex gap-1">
          {(['all', 'client', 'walker', 'admin'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setSearchParams(r === 'all' ? {} : { role: r })}
              className={`px-3 py-1 text-sm rounded-full ${
                filter === r ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Suburb</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link to={`/admin/users/${encodeURIComponent(user.id)}`} className="text-emerald-700 hover:underline">
                    {user.name || user.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                <td className="px-4 py-3 text-slate-600">{user.suburb || '-'}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                    disabled={updatingId === user.id}
                    className="text-xs border border-slate-300 rounded px-2 py-1 text-slate-900 disabled:opacity-50"
                  >
                    <option value="client">Client</option>
                    <option value="walker">Walker</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-slate-500 py-8">No users found.</p>}
      </div>
    </div>
  );
}
