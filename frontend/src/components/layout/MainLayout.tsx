import DashboardLayout from '../shared/DashboardLayout';
import { useAuthStore } from '../../store/authStore';

const MainLayout = () => {
  const role = useAuthStore((state) => state.user?.role);
  return <DashboardLayout role={role === 'admin' || role === 'teacher' ? role : 'student'} />;
};

export default MainLayout;
