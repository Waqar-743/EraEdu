import { useCallback, useState } from 'react';
import { useLiveRefresh } from '../../../hooks/useLiveRefresh';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import { StatCard } from '../../../components/shared';
import api from '../../../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Notification {
  id: string;
  title: string;
  message: string;
  quiz_code: string;
  is_read: boolean;
  created_at: string;
}

interface StudentAnalytics {
  totalQuizzes: number;
  avgScore: number | null;
  passRate: number | null;
  pendingReviews: number;
  streakDays: number;
  performanceData: { week: string; score: number }[];
}

const Stroke = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const StudentOverview = () => {
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await api.get('/quizzes/student/analytics');
      setAnalytics(response.data.data);
      setAnalyticsError(false);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setAnalytics(null);
      setAnalyticsError(true);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useLiveRefresh(fetchAnalytics);
  useLiveRefresh(fetchNotifications, { intervalMs: 10000 });

  if (analyticsLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="relative h-12 w-12">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      </div>
    );
  }

  if (analyticsError) return <div role="alert" className="p-6 text-red-800">
    <p>Unable to load your exam summary.</p>
    <button type="button" className="mt-3 underline focus-visible:ring-2" onClick={() => void fetchAnalytics()}>Retry</button>
  </div>;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {!!analytics?.pendingReviews && <p role="status" className="rounded bg-amber-50 p-3 text-amber-900">{analytics.pendingReviews} exam result(s) await a final teacher grade. Completed multiple-choice exams are included automatically.</p>}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h1 className="text-2xl font-semibold text-gray-900">Welcome back, {user?.name}</h1>
          <p className="mt-2 text-sm text-gray-600">Enter the exam code shared by your teacher to begin.</p>
          <p className="mt-2 text-sm text-gray-500">{analytics?.streakDays || 0} day streak · {analytics?.totalQuizzes || 0} exams completed</p>
        </div>
        <Link to="/dashboard/student/join-quiz" className="btn-primary">Join Exam</Link>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Stroke d="M9 11l3 3 7-7 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10" />}
          label="Exams Completed"
          value={analytics?.totalQuizzes || 0}
          color="primary"
        />
        <StatCard
          icon={<Stroke d="M3 21h18 M6 17V9 M11 17V5 M16 17v-7 M21 17v-3" />}
          label="Average Score"
          value={analytics?.avgScore != null ? `${analytics.avgScore}%` : 'Not released'}
          color="blue"
          trend={analytics?.avgScore == null ? undefined : analytics.avgScore >= 60 ? 'up' : 'down'}
        />
        <StatCard
          icon={<Stroke d="m9 12 2 2 4-4 M3 12a9 9 0 1 1 18 0 9 9 0 0 1-18 0z" />}
          label="Pass Rate"
          value={analytics?.passRate == null ? 'Not released' : `${analytics.passRate}%`}
          color="green"
          trend={analytics?.passRate == null ? undefined : analytics.passRate >= 60 ? 'up' : 'down'}
        />
        <StatCard
          icon={<Stroke d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />}
          label="Learning Streak"
          value={`${analytics?.streakDays || 0} Days`}
          color="orange"
        />
      </section>

      {/* Performance + Notifications */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Performance */}
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white">
          <div className="rounded-lg bg-white p-6 sm:p-7 shadow-sm">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
              Trajectory
            </span>
            <h3 className="mt-1 font-sans text-[20px] tracking-tight text-ink-900">
              Performance Trend
            </h3>
            {analytics?.performanceData && analytics.performanceData.length > 0 ? (
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFF1F3" />
                    <XAxis dataKey="week" stroke="#7E8896" fontSize={11} />
                    <YAxis stroke="#7E8896" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid rgba(15,23,42,0.06)',
                        borderRadius: '14px',
                        boxShadow: '0 24px 60px -20px rgba(15,23,42,0.18)',
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={{ fill: '#2563eb', strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 7, fill: '#2563eb', stroke: '#fff', strokeWidth: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 mt-4 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-ink-50 ring-1 ring-ink-900/5 text-ink-400">
                    <Stroke d="M3 21h18 M6 17V9 M11 17V5 M16 17v-7 M21 17v-3" />
                  </div>
                  <p className="text-[13px] text-ink-500">Complete exams to see your performance trend</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
                  Inbox
                </span>
                <h3 className="mt-1 font-sans text-[20px] tracking-tight text-ink-900">
                  Notifications
                </h3>
              </div>
              <span className="inline-flex items-center justify-center h-7 min-w-[28px] px-2 rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700 ring-1 ring-primary-100">
                {notifications.filter((n) => !n.is_read).length}
              </span>
            </div>

            {notifLoading ? (
              <div className="mt-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 bg-ink-100 rounded w-3/4 mb-2"></div>
                    <div className="h-2.5 bg-ink-100/70 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : notifications.length > 0 ? (
              <ul className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
                {notifications.slice(0, 5).map((notif) => (
                  <li
                    key={notif.id}
                    className={`
                      relative rounded-lg px-4 py-3 transition-colors duration-500
                      ${notif.is_read ? 'bg-ink-50/60 ring-1 ring-ink-900/[0.04]' : 'bg-primary-50/60 ring-1 ring-primary-100'}
                    `}
                  >
                    {!notif.is_read && (
                      <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-primary-500" />
                    )}
                    <p className="text-[13px] font-semibold text-ink-900">{notif.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-500 line-clamp-2">{notif.message}</p>
                    {notif.quiz_code && (
                      <p className="mt-2 inline-flex rounded-md bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-primary-700 ring-1 ring-primary-100">
                        {notif.quiz_code}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[13px] text-ink-500">
                No notifications yet. Your teacher will notify you when a new exam is available.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="rounded-lg bg-white p-6 sm:p-7 shadow-sm">
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-400">
            Shortcuts
          </span>
          <h3 className="mt-1 font-sans text-[20px] tracking-tight text-ink-900">Quick Actions</h3>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              {
                to: '/dashboard/student/join-quiz',
                title: 'Join Exam',
                desc: 'Enter a code to take an exam',
                d: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v2h-2z M14 18h2v2h-2z M18 18h2v2h-2z',
              },
              {
                to: '/dashboard/student/quiz-history',
                title: 'Exam History',
                desc: 'Review your past attempts',
                d: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 8v4l3 2',
              },
              {
                to: '/dashboard/student/courses',
                title: 'My Courses',
                desc: 'Browse enrolled courses',
                d: 'M4 5a2 2 0 0 1 2-2h11v17H6a2 2 0 0 1-2-2V5z M9 3v17 M17 7H9 M17 11H9',
              },
              {
                to: '/analytics',
                title: 'My Analytics',
                desc: 'Detailed performance insights',
                d: 'M3 21h18 M6 17V9 M11 17V5 M16 17v-7 M21 17v-3',
              },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="
                  group flex items-center gap-4 rounded-lg
                  bg-ink-50/60 ring-1 ring-ink-900/[0.04] px-4 py-3.5
                  transition-colors duration-150 ease-[cubic-bezier(0.32,0.72,0,1)]
                  hover:bg-white hover:ring-primary-200 hover:shadow-sm

                "
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white ring-1 ring-ink-900/5 text-primary-700 shadow-sm">
                  <Stroke d={a.d} size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink-900">{a.title}</p>
                  <p className="text-[12px] text-ink-500">{a.desc}</p>
                </div>
                <span
                  className="
                    flex h-8 w-8 items-center justify-center rounded-full
                    bg-ink-900/[0.04] ring-1 ring-ink-900/5 text-ink-500
                    transition-colors duration-150 ease-[cubic-bezier(0.32,0.72,0,1)]

                    group-hover:bg-primary-50 group-hover:text-primary-700 group-hover:ring-primary-200
                  "
                >
                  <Stroke d="M5 12h14 M12 5l7 7-7 7" size={12} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default StudentOverview;
