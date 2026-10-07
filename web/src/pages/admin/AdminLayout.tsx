import { Outlet } from 'react-router-dom';
import { AdminNav } from './adminUi';

export default function AdminLayout() {
  return (
    <div>
      <AdminNav />
      <Outlet />
    </div>
  );
}
