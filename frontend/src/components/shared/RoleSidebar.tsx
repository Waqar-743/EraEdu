import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Brand from './Brand';
import { useAuthStore } from '../../store/authStore';

export interface SidebarItem { label: string; href: string; icon: React.ReactNode; }
interface RoleSidebarProps {
  items: SidebarItem[];
  isOpen: boolean;
  onClose: () => void;
  role: 'student' | 'teacher' | 'admin';
  collapsed?: boolean;
}
const roleLabels = { student: 'Learner', teacher: 'Educator', admin: 'Administrator' };

const RoleSidebar: React.FC<RoleSidebarProps> = ({ items, isOpen, onClose, role, collapsed = false }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const handleSignOut = () => { logout(); navigate('/login'); };
  return <>
    {isOpen && <button type="button" aria-label="Close sidebar backdrop" className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={onClose} />}
    <aside id="dashboard-sidebar" aria-label={`${roleLabels[role]} dashboard navigation`}
      className={`fixed inset-y-0 left-0 z-30 flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white lg:static ${collapsed ? 'lg:w-20' : 'lg:w-64'} ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className={`flex h-16 items-center justify-between border-b border-gray-200 px-5 ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}>
        <span className="lg:hidden"><Brand to="/" /></span>
        <span className="hidden lg:inline-flex"><Brand to="/" iconOnly={collapsed} /></span>
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xl text-gray-600 lg:hidden" aria-label="Close sidebar">×</button>
      </div>
      <p className={`px-5 py-4 text-xs font-semibold text-gray-500 ${collapsed ? 'lg:hidden' : ''}`}>{roleLabels[role]}</p>
      <nav aria-label="Dashboard navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map(item => <NavLink key={item.label} to={item.href} aria-label={item.label} title={collapsed ? item.label : undefined}
          end={item.href.split('/').length <= 3}
          onClick={() => { if (window.innerWidth < 1024) onClose(); }}
          className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium ${collapsed ? 'lg:justify-center lg:px-1' : ''} ${isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
          <span className="flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
          <span className={collapsed ? 'lg:hidden' : ''}>{item.label}</span>
        </NavLink>)}
      </nav>
      <div className="mt-auto border-t border-gray-200 p-4">
        <div className={collapsed ? 'lg:hidden' : ''}>
          <p className="truncate text-sm font-semibold text-gray-900">{user?.name}</p>
          <p className="mt-1 truncate text-xs text-gray-500">{user?.email}</p>
        </div>
        <button type="button" onClick={handleSignOut} aria-label="Sign out" title={collapsed ? 'Sign out' : undefined}
          className="mt-3 w-full rounded-md px-2 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900">
          {collapsed ? <><span className="hidden lg:inline" aria-hidden="true">↪</span><span className="lg:hidden">Sign out</span></> : 'Sign out'}
        </button>
      </div>
    </aside>
  </>;
};
export default RoleSidebar;
