import { useCallback, useState } from 'react';
import { useLiveRefresh } from '../../../hooks/useLiveRefresh';
import { StatCard } from '../../../components/shared';
import api from '../../../services/api';
import {
  UserGroupIcon,
  AcademicCapIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';

interface AnalyticsData {
  totalStudents: number;
  totalQuizzes: number;
  totalAttempts: number;
  avgScore: number | null;
  passRate: number | null;
  reviewedAttempts: number;
  pendingReviews: number;
  scoreDistribution: { range: string; count: number; color: string }[];
  weeklyData: { date: string; attempts: number; avgScore: number | null }[];
  courseParticipation: {
    courseId: string;
    courseName: string;
    enrolledStudents: number;
    attemptedStudents: number;
    participationPercentage: number;
  }[];
}

// Score thresholds are semantic; their presentation belongs to the shared UI,
// rather than colour strings supplied by the analytics response.
const scoreBucketFill: Record<string, string> = {
  '0-50': 'fill-red-500',
  '50-70': 'fill-amber-500',
  '70-85': 'fill-[var(--color-chart-primary-600)]',
  '85-100': 'fill-[var(--color-chart-primary-800)]',
};

const TeacherAnalytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get('/quizzes/teacher/analytics');
      if (!Number.isSafeInteger(response.data.data?.totalStudents) || response.data.data.totalStudents < 0) {
        throw new Error('Teacher analytics response is incomplete. Please retry.');
      }
      setAnalytics(response.data.data);
    } catch (caught: any) {
      setAnalytics(null);
      setError(caught.response?.data?.error?.message || caught.message || 'Could not load teacher analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useLiveRefresh(fetchAnalytics);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
      <p>{error || 'Teacher analytics are unavailable.'}</p>
      <button type="button" onClick={() => void fetchAnalytics()} className="mt-2 underline">Retry</button>
    </div>;
  }

  const hasData = !!analytics && (
    analytics.totalAttempts > 0 ||
    (analytics.courseParticipation && analytics.courseParticipation.length > 0)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Analytics Dashboard</h1>
        <p className="text-sm text-ink-500 mt-1">Track student performance and engagement</p>
        <p className="text-xs text-ink-500 mt-1">Total Students counts each learner once across your assigned courses.</p>
        <p className="text-xs text-ink-500 mt-1">Average score and pass rate include completed multiple-choice exams and final teacher grades; 60% or higher passes. {analytics.pendingReviews > 0 && `${analytics.pendingReviews} submission(s) await a final grade.`}</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<UserGroupIcon className="h-6 w-6" />}
          label="Total Students"
          value={analytics.totalStudents}
          color="primary"
        />
        <StatCard
          icon={<AcademicCapIcon className="h-6 w-6" />}
          label="Exam Attempts"
          value={analytics?.totalAttempts || 0}
          color="primary"
        />
        <StatCard
          icon={<ChartBarIcon className="h-6 w-6" />}
          label="Average Score"
          value={analytics.avgScore == null ? 'Pending' : `${analytics.avgScore}%`}
          color="primary"
          trend={analytics.avgScore == null ? undefined : analytics.avgScore >= 60 ? 'up' : 'down'}
        />
        <StatCard
          icon={<ClockIcon className="h-6 w-6" />}
          label="Pass Rate"
          value={analytics.passRate == null ? 'Pending' : `${analytics.passRate}%`}
          color="primary"
          trend={analytics.passRate == null ? undefined : analytics.passRate >= 60 ? 'up' : 'down'}
        />
      </div>

      {!hasData ? (
        <div className="bg-white rounded-xl shadow-sm border border-ink-200 p-12 text-center">
          <AcademicCapIcon className="h-16 w-16 mx-auto text-ink-300 mb-4" />
          <h3 className="text-lg font-medium text-ink-900 mb-2">No Exam Data Yet</h3>
          <p className="text-ink-500">
            Create exams and have students take them to see analytics data here.
          </p>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Performance Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-ink-200 p-6">
              <h3 className="text-lg font-semibold text-ink-900 mb-4">Weekly Performance</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics?.weeklyData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" stroke="rgb(var(--color-ink-500))" fontSize={12} />
                    <YAxis stroke="rgb(var(--color-ink-500))" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      itemStyle={{ color: 'var(--color-text)' }}
                      contentStyle={{
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgScore"
                      stroke="var(--color-chart-primary-600)"
                      strokeWidth={2}
                      dot={{ fill: 'var(--color-chart-primary-600)' }}
                      name="Avg Score %"
                    />
                    <Legend formatter={(value) => <span style={{ color: 'var(--color-text)' }}>{value}</span>} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-ink-200 p-6">
              <h3 className="text-lg font-semibold text-ink-900 mb-4">Score Distribution</h3>
              <div className="h-72">
                {(analytics?.scoreDistribution || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics?.scoreDistribution || []}
                      margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis
                        dataKey="range"
                        stroke="rgb(var(--color-ink-500))"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text)' }}
                        label={{ value: 'Score Range', position: 'insideBottom', offset: -10, fill: 'rgb(var(--color-ink-500))', fontSize: 12 }}
                      />
                      <YAxis
                        stroke="rgb(var(--color-ink-500))"
                        fontSize={12}
                        allowDecimals={false}
                        label={{ value: 'Students', angle: -90, position: 'insideLeft', fill: 'rgb(var(--color-ink-500))', fontSize: 12 }}
                      />
                      <Tooltip
                        itemStyle={{ color: 'var(--color-text)' }}
                        formatter={(value: any) => [`${value} student${value !== 1 ? 's' : ''}`, 'Count']}
                        contentStyle={{
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-text)',
                          border: '1px solid var(--color-border)',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgb(var(--color-ink-900) / 0.1)',
                        }}
                      />
                      <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>
                        {(analytics?.scoreDistribution || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} className={scoreBucketFill[entry.range] || 'fill-[var(--color-chart-primary-600)]'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-ink-400">
                    <p>No score data available yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quiz Attempts by Week */}
          <div className="bg-white rounded-xl shadow-sm border border-ink-200 p-6">
            <h3 className="text-lg font-semibold text-ink-900 mb-4">Weekly Exam Attempts</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.weeklyData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" stroke="rgb(var(--color-ink-500))" fontSize={12} />
                  <YAxis stroke="rgb(var(--color-ink-500))" fontSize={12} />
                  <Tooltip
                    itemStyle={{ color: 'var(--color-text)' }}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="attempts" fill="var(--color-chart-primary-600)" name="Attempts" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Course Participation (Straight Chart) */}
          <div className="bg-white rounded-xl shadow-sm border border-ink-200 p-6">
            <h3 className="text-lg font-semibold text-ink-900 mb-4">Course Participation (%)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics?.courseParticipation || []} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" stroke="rgb(var(--color-ink-500))" fontSize={12} domain={[0, 100]} />
                  <YAxis type="category" dataKey="courseName" stroke="rgb(var(--color-ink-500))" fontSize={12} width={140} />
                  <Tooltip
                    itemStyle={{ color: 'var(--color-text)' }}
                    formatter={(value: any, _name: any, payload: any) => {
                      const course = payload?.payload;
                      return [
                        `${value}% ( ${course?.attemptedStudents || 0} / ${course?.enrolledStudents || 0} students )`,
                        'Participation'
                      ];
                    }}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="participationPercentage" fill="var(--color-chart-primary-600)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-primary-700 to-primary-800 rounded-xl p-6 text-white">
              <h4 className="text-lg font-semibold mb-2">Pass Rate</h4>
              <p className="text-4xl font-bold">{analytics.passRate == null ? 'Pending' : `${analytics.passRate}%`}</p>
              <p className="text-white/90 mt-2">
                {analytics.passRate == null ? 'Publish grades to see the pass rate.' : analytics.passRate >= 70
                  ? 'Great job! Students are performing well.'
                  : 'Consider reviewing difficult topics.'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-primary-700 to-primary-800 rounded-xl p-6 text-white">
              <h4 className="text-lg font-semibold mb-2">Total Exams</h4>
              <p className="text-4xl font-bold">{analytics?.totalQuizzes || 0}</p>
              <p className="text-white/90 mt-2">Exams created and available</p>
            </div>
            <div className="bg-gradient-to-br from-primary-700 to-primary-800 rounded-xl p-6 text-white">
              <h4 className="text-lg font-semibold mb-2">Engagement</h4>
              <p className="text-4xl font-bold">{analytics?.totalAttempts || 0}</p>
              <p className="text-white/90 mt-2">Total exam attempts by students</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherAnalytics;
