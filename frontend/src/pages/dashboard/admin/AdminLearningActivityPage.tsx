import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AcademicCapIcon, ChartBarIcon, ClipboardDocumentCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { StatCard } from '../../../components/shared';
import { useLiveRefresh } from '../../../hooks/useLiveRefresh';
import api from '../../../services/api';
import { buildAdminRoster, matchesReportSearch, reportPage, type AdminLearningActivity, type ReportAttempt } from '../../../services/adminLearningView';

const teacherMatches = (selected: string, id: string | null) => selected === 'all' || (selected === 'unassigned' ? !id : selected === id);
const dateLabel = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : 'Not recorded';
const resultLabel = (attempt: ReportAttempt) => attempt.status !== 'completed' ? (attempt.status === 'in_progress' ? 'In progress' : attempt.status.replace(/_/g, ' '))
  : attempt.percentage === null ? 'Awaiting review' : `${attempt.percentage}%`;

function Pagination({ page, pages, total, onChange, label }: { page: number; pages: number; total: number; onChange: (page: number) => void; label: string }) {
  return <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 px-4 py-3 text-sm text-ink-600">
    <span>{total} {label.toLowerCase()} · Page {page} of {pages}</span>
    <div className="flex gap-2"><button type="button" className="rounded-lg border border-primary-200 px-3 py-1.5 font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-40" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <button type="button" className="rounded-lg border border-primary-200 px-3 py-1.5 font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-40" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button></div>
  </nav>;
}

function AttemptsTable({ rows }: { rows: ReportAttempt[] }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
    <thead className="bg-primary-50 text-ink-600"><tr>{['Student', 'Teacher', 'Course', 'Test', 'Submitted', 'Result'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.id} className="border-t border-ink-200 align-top">
      <td className="px-4 py-3"><p className="font-semibold text-ink-900">{row.studentName}</p><p className="text-xs text-ink-500">{row.studentEmail}</p></td>
      <td className="px-4 py-3"><p className="font-medium text-ink-900">{row.teacherName}</p><p className="text-xs text-ink-500">{row.teacherEmail}</p></td>
      <td className="px-4 py-3 text-ink-700">{row.courseTitle}</td>
      <td className="px-4 py-3"><p className="font-medium text-ink-900">{row.testTitle}</p><p className="text-xs text-ink-500">{row.testType}{row.topicTitle ? ` · ${row.topicTitle}` : ''}</p>{row.referenceIssues.length > 0 && <p className="mt-1 text-xs text-amber-700">{row.referenceIssues.join(', ')}</p>}</td>
      <td className="whitespace-nowrap px-4 py-3 text-ink-500">{row.completedAt ? dateLabel(row.completedAt) : 'Not submitted'}</td>
      <td className="px-4 py-3"><p className="whitespace-nowrap font-semibold text-primary-700">{resultLabel(row)}</p>{row.percentage !== null && <p className="text-xs text-ink-500">{row.gradeSource === 'teacher' ? 'Teacher grade' : 'Automatic grade'}</p>}
        {row.status === 'completed' && row.referenceIssues.length === 0 && <Link to={`/quiz/results/${row.id}`} className="mt-1 inline-block font-semibold text-primary-700 underline">View result</Link>}</td>
    </tr>)}</tbody>
  </table></div>;
}

export default function AdminLearningActivityPage({ view }: { view: 'analytics' | 'submissions' }) {
  const [data, setData] = useState<AdminLearningActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const request = useRef(0);
  const [teacherId, setTeacherId] = useState('all');
  const [courseId, setCourseId] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [teacherPage, setTeacherPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
  const [attemptPage, setAttemptPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [selected, setSelected] = useState<{ studentId: string; courseId: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const fetchActivity = useCallback(async () => {
    const id = ++request.current;
    setRefreshing(true);
    try {
      const response = await api.get('/admin/learning-activity');
      const next = response.data?.data;
      if (!next?.summary || !['teachers', 'students', 'courses', 'enrollments', 'attempts'].every(key => Array.isArray(next[key]))) {
        throw new Error('Administrator activity response is incomplete. Please retry.');
      }
      if (id === request.current) { setData(next); setError(null); }
    } catch (caught: any) {
      if (id === request.current) { setData(null); setSelected(null); setError(caught.response?.data?.error?.message || caught.message || 'Administrator activity could not be loaded.'); }
    } finally { if (id === request.current) setRefreshing(false); }
  }, []);
  useLiveRefresh(fetchActivity, { intervalMs: 30000, enabled: !selected });
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    return () => { dialog.current?.close(); };
  }, [selected]);

  const roster = useMemo(() => data ? buildAdminRoster(data) : [], [data]);
  const resetPages = () => { setTeacherPage(1); setStudentPage(1); setAttemptPage(1); };
  const chooseTeacher = (id: string) => { setTeacherId(id); setCourseId('all'); resetPages(); };
  const chooseCourse = (id: string) => { setCourseId(id); resetPages(); };
  const withinFilters = (course: string | null, teacher: string | null) => teacherMatches(teacherId, teacher) && (courseId === 'all' || courseId === course);
  const filteredRoster = roster.filter(row => withinFilters(row.courseId, row.teacherId) && matchesReportSearch(search,
    row.studentName, row.studentEmail, row.teacherName, row.courseTitle, ...row.attempts.map(attempt => attempt.testTitle)));
  const filteredAttempts = (data?.attempts || []).filter(row => withinFilters(row.courseId, row.teacherId)
    && matchesReportSearch(search, row.studentName, row.studentEmail, row.teacherName, row.teacherEmail, row.courseTitle, row.testTitle)
    && (status === 'all' || (status === 'pending' ? row.gradeSource === 'pending' : row.status === status)));
  const matchedCourses = new Set([...filteredRoster.map(row => row.courseId), ...filteredAttempts.map(row => row.courseId)]);
  const teachers = data ? [...data.teachers, ...(data.courses.some(course => !course.teacherId)
    ? [{ id: 'unassigned', name: 'Unassigned teacher', email: '', role: 'unknown' }] : [])] : [];
  const directory = teachers.filter(teacher => teacherId === 'all' || teacher.id === teacherId).map(teacher => ({
    ...teacher,
    courses: (data?.courses || []).filter(course => (course.teacherId || 'unassigned') === teacher.id && (courseId === 'all' || course.id === courseId)
      && (matchesReportSearch(search, teacher.name, teacher.email, course.title) || matchedCourses.has(course.id))),
  })).filter(teacher => teacher.courses.length > 0 || (courseId === 'all' && matchesReportSearch(search, teacher.name, teacher.email)));
  const teacherRows = reportPage(directory, teacherPage, 10);
  const studentRows = reportPage(filteredRoster, studentPage);
  const attemptRows = reportPage(filteredAttempts, attemptPage);
  const history = selected ? reportPage(data?.attempts.filter(row => row.studentId === selected.studentId && row.courseId === selected.courseId) || [], historyPage) : null;
  const selectedStudent = data?.students.find(student => student.id === selected?.studentId);
  const selectedCourse = data?.courses.find(course => course.id === selected?.courseId);

  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-ink-900">{view === 'analytics' ? 'Learning Analytics' : 'Student Submissions'}</h1><p className="mt-1 text-sm text-ink-500">Teachers, joined courses, and student tests.</p></div>
      <button type="button" className="btn-primary" disabled={refreshing} onClick={() => void fetchActivity()}>{refreshing ? 'Refreshing…' : 'Refresh'}</button></header>
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}<button type="button" className="ml-2 font-semibold underline" onClick={() => void fetchActivity()}>Retry</button></div>
      : !data ? <div role="status" className="flex items-center justify-center gap-3 py-20 text-ink-600"><span aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />Loading learning activity…</div> : <>
        {view === 'analytics' && <><p className="text-sm font-semibold text-ink-700">Platform totals</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Teachers" value={data.summary.totalTeachers} color="primary" icon={<UserGroupIcon className="h-6 w-6" />} />
          <StatCard label="Enrolled Students" value={data.summary.totalStudents} color="primary" icon={<AcademicCapIcon className="h-6 w-6" />} />
          <StatCard label="Courses" value={data.summary.totalCourses} color="primary" icon={<ClipboardDocumentCheckIcon className="h-6 w-6" />} />
          <StatCard label="Pass Rate" value={data.summary.passRate === null ? 'Pending' : `${data.summary.passRate}%`} color="primary" icon={<ChartBarIcon className="h-6 w-6" />} />
        </div><p className="text-sm text-ink-500">{data.summary.totalTests} created tests · {data.summary.completedAttempts} completed attempts · Average score: {data.summary.averageScore === null ? 'Pending' : `${data.summary.averageScore}%`}{data.summary.pendingReviews > 0 ? ` · ${data.summary.pendingReviews} awaiting review` : ''}</p></>}
        <div className="grid gap-3 rounded-2xl border border-ink-200 bg-white p-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-ink-700">Search<input aria-label="Search" className="input-field mt-1" placeholder="Student, teacher, course, or test" value={search} onChange={event => { setSearch(event.target.value); resetPages(); }} /></label>
          <label className="text-sm font-semibold text-ink-700">Teacher<select aria-label="Teacher" className="input-field mt-1" value={teacherId} onChange={event => chooseTeacher(event.target.value)}><option value="all">All teachers</option>{teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
          <label className="text-sm font-semibold text-ink-700">Course<select aria-label="Course" className="input-field mt-1" value={courseId} onChange={event => chooseCourse(event.target.value)}><option value="all">All courses</option>{data.courses.filter(course => teacherMatches(teacherId, course.teacherId)).map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        </div>
        <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white" aria-labelledby="teacher-directory-title"><h2 id="teacher-directory-title" className="p-4 text-lg font-semibold text-ink-900">Teachers & courses</h2>
          <div className="divide-y divide-ink-200">{teacherRows.rows.map(teacher => <details key={teacher.id} open className="px-4 py-3"><summary className="cursor-pointer text-sm font-semibold text-ink-900">{teacher.name}<span className="ml-2 font-normal text-ink-500">{teacher.email}</span>{teacher.role !== 'teacher' && teacher.role !== 'unknown' && <span className="ml-2 text-xs font-normal">({teacher.role})</span>}</summary>
            <div className="mt-3 flex flex-wrap gap-2">{teacher.courses.length ? teacher.courses.map(course => <button key={course.id} type="button" aria-pressed={courseId === course.id} onClick={() => { setTeacherId(teacher.id); chooseCourse(course.id); }} className={`rounded-xl border px-3 py-2 text-left text-sm ${courseId === course.id ? 'border-primary-500 bg-primary-100' : 'border-primary-200 bg-primary-50 hover:bg-primary-100'}`}><span className="block font-semibold text-primary-800">{course.title}</span><span className="block text-xs text-ink-500">{course.studentCount} students · {course.testCount} tests{course.published === false ? ' · Unpublished' : ''}</span></button>) : <p className="text-sm text-ink-500">No courses assigned.</p>}</div>
          </details>)}{!teacherRows.total && <p className="px-4 pb-5 text-sm text-ink-500">No matching teachers or courses.</p>}</div>
          <Pagination {...teacherRows} onChange={setTeacherPage} label="Teachers" />
        </section>
        <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white" aria-labelledby="student-roster-title"><h2 id="student-roster-title" className="p-4 text-lg font-semibold text-ink-900">Students & joined courses</h2>
          {!studentRows.total ? <p className="px-4 pb-5 text-sm text-ink-500">No matching enrolled students.</p> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-primary-50 text-ink-600"><tr>{['Student', 'Course joined', 'Teacher', 'Joined', 'Tests', 'Details'].map(label => <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody>{studentRows.rows.map(row => <tr key={row.id} className="border-t border-ink-200 align-top"><td className="px-4 py-3"><p className="font-semibold text-ink-900">{row.studentName}</p><p className="text-xs text-ink-500">{row.studentEmail}</p></td><td className="px-4 py-3 text-ink-700">{row.courseTitle}</td><td className="px-4 py-3 text-ink-700">{row.teacherName}</td><td className="whitespace-nowrap px-4 py-3 text-ink-500">{dateLabel(row.joinedAt)}</td><td className="px-4 py-3"><span className="font-semibold text-primary-700">{row.completedTests} completed</span><p className="text-xs text-ink-500">{row.attempts.length} attempts</p></td><td className="px-4 py-3"><button type="button" className="whitespace-nowrap font-semibold text-primary-700 underline" onClick={() => { setHistoryPage(1); setSelected({ studentId: row.studentId, courseId: row.courseId }); }}>View tests<span className="sr-only"> for {row.studentName} in {row.courseTitle}</span></button></td></tr>)}</tbody></table></div>}
          <Pagination {...studentRows} onChange={setStudentPage} label="Enrollments" />
        </section>
        {view === 'submissions' && <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white" aria-labelledby="attempt-list-title"><div className="flex flex-wrap items-center justify-between gap-3 p-4"><h2 id="attempt-list-title" className="text-lg font-semibold text-ink-900">Test attempts</h2><label className="text-sm text-ink-600">Status<select aria-label="Status" className="ml-2 rounded-lg border border-primary-200 bg-white p-2" value={status} onChange={event => { setStatus(event.target.value); setAttemptPage(1); }}><option value="all">All attempts</option><option value="completed">Completed</option><option value="in_progress">In progress</option><option value="pending">Awaiting review</option></select></label></div>
          {attemptRows.total ? <AttemptsTable rows={attemptRows.rows} /> : <p className="px-4 pb-5 text-sm text-ink-500">No matching test attempts.</p>}<Pagination {...attemptRows} onChange={setAttemptPage} label="Attempts" />
        </section>}
      </>}
    {selected && <dialog ref={dialog} onCancel={() => setSelected(null)} className="max-h-[85vh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto rounded-2xl border border-ink-200 bg-white p-0 text-ink-900 shadow-xl backdrop:bg-black/50" aria-labelledby="student-test-history-title">
      <div className="flex items-start justify-between gap-4 p-5"><div><h2 id="student-test-history-title" className="text-lg font-semibold">{selectedStudent?.name || 'Student'} — Test history</h2><p className="text-sm text-ink-500">{selectedStudent?.email} · {selectedCourse?.title || 'Course unavailable'}</p></div><button type="button" className="rounded-lg border border-primary-200 px-3 py-1.5 text-sm font-semibold text-primary-700" onClick={() => setSelected(null)}>Close</button></div>
      {history?.total ? <AttemptsTable rows={history.rows} /> : <p className="px-5 pb-8 text-sm text-ink-500">No test attempts yet in this course.</p>}
      {history && <Pagination {...history} onChange={setHistoryPage} label="Attempts" />}
    </dialog>}
  </div>;
}
