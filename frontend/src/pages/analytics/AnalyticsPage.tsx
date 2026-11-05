import { useAnalytics } from '../../hooks/useAnalytics';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';

export default function AnalyticsPage() {
  const { stats, loading, error, fetchDashboardStats } = useAnalytics();
  useLiveRefresh(fetchDashboardStats);
  if (loading) return <p role="status" className="p-6">Loading analytics…</p>;
  if (error) return <div role="alert" className="p-6 text-red-800">
    <p>{error}</p><button className="mt-3 underline focus-visible:ring-2" onClick={() => void fetchDashboardStats()}>Retry</button>
  </div>;
  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <h1 className="text-2xl font-bold text-ink-900">Your exam analytics</h1>
    <p className="text-ink-700">Scores include completed multiple-choice exams, topic exams and published teacher grades. Exams with written answers await a final teacher grade. A grade of 60% or higher passes.</p>
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border bg-white p-6"><dt>Enrolled courses</dt><dd className="text-2xl font-semibold">{stats?.coursesEnrolled ?? '—'}</dd></div>
      <div className="rounded-lg border bg-white p-6"><dt>Completed exams</dt><dd className="text-2xl font-semibold">{stats?.quizzesCompleted ?? '—'}</dd></div>
      <div className="rounded-lg border bg-white p-6"><dt>Released average score</dt><dd className="text-2xl font-semibold">{stats?.averageScore != null ? `${stats.averageScore}%` : 'No released results'}</dd></div>
      <div className="rounded-lg border bg-white p-6"><dt>Pass rate</dt><dd className="text-2xl font-semibold">{stats?.passRate != null ? `${stats.passRate}%` : 'No released results'}</dd></div>
    </dl>
    {!!stats?.pendingReviews && <p role="status" className="rounded bg-amber-50 p-4 text-amber-900">{stats.pendingReviews} result(s) pending teacher review.</p>}
  </main>;
}
