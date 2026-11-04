export interface ReportPerson { id: string; name: string; email: string; role: string }
export interface ReportCourse { id: string; title: string; teacherId: string | null; published: boolean; studentCount: number; testCount: number }
export interface ReportAttempt {
  id: string; studentId: string; studentName: string; studentEmail: string;
  teacherId: string | null; teacherName: string; teacherEmail: string;
  courseId: string | null; courseTitle: string; testId: string; testTitle: string; testType: string;
  topicTitle: string | null; status: string; percentage: number | null;
  gradeSource: 'in_progress' | 'pending' | 'teacher' | 'automatic';
  startedAt: string | null; completedAt: string | null; referenceIssues: string[];
}
export interface AdminLearningActivity {
  summary: { totalTeachers: number; totalStudents: number; totalCourses: number; totalTests: number;
    completedAttempts: number; averageScore: number | null; passRate: number | null; pendingReviews: number };
  teachers: ReportPerson[]; students: ReportPerson[]; courses: ReportCourse[];
  enrollments: { id: string; courseId: string; studentId: string; joinedAt: string | null }[];
  attempts: ReportAttempt[];
}

export const matchesReportSearch = (search: string, ...values: (string | null | undefined)[]) => {
  const query = search.trim().toLocaleLowerCase();
  return !query || values.some(value => value?.toLocaleLowerCase().includes(query));
};

export function buildAdminRoster(data: AdminLearningActivity) {
  const students = new Map(data.students.map(person => [person.id, person]));
  const teachers = new Map(data.teachers.map(person => [person.id, person]));
  const courses = new Map(data.courses.map(course => [course.id, course]));
  const histories = new Map<string, ReportAttempt[]>();
  for (const attempt of data.attempts) {
    const key = `${attempt.courseId}:${attempt.studentId}`;
    const history = histories.get(key) || [];
    history.push(attempt); histories.set(key, history);
  }
  return data.enrollments.map(enrollment => {
    const course = courses.get(enrollment.courseId);
    const teacher = course?.teacherId ? teachers.get(course.teacherId) : null;
    const student = students.get(enrollment.studentId);
    const attempts = histories.get(`${enrollment.courseId}:${enrollment.studentId}`) || [];
    return { ...enrollment, studentName: student?.name || 'Account unavailable', studentEmail: student?.email || '',
      courseTitle: course?.title || 'Course unavailable', teacherId: course?.teacherId || null,
      teacherName: teacher?.name || 'Unassigned teacher', attempts,
      completedTests: new Set(attempts.filter(attempt => attempt.status === 'completed').map(attempt => `${attempt.testType}:${attempt.testId}`)).size,
    };
  }).sort((a, b) => a.studentName.localeCompare(b.studentName) || a.courseTitle.localeCompare(b.courseTitle));
}

export function reportPage<T>(rows: T[], requestedPage: number, pageSize = 20) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pages, Math.max(1, requestedPage));
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pages, total: rows.length };
}
