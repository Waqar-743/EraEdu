import { readAllRows } from './analyticsService';
import { finalResultPercentage, summarizeResults } from './resultMetrics';

// Admin reports use the complete platform population, rather than treating the
// administrator's account as a teacher. Only public report fields leave here.
export const adminLearningService = {
  async getActivity() {
    try {
      const read = (table: string, fields: string) => readAllRows(table, fields, query => query);
      const [users, courses, enrollments, teacherTests, topics, topicTests, attempts] = await Promise.all([
        read('users', 'id, name, email, role'),
        read('courses', 'id, title, created_by, is_published'),
        read('enrollments', 'id, user_id, course_id, enrolled_at'),
        read('teacher_quizzes', 'id, title, course_id, teacher_id'),
        read('topics', 'id, title, course_id'),
        read('quizzes', 'id, title, topic_id'),
        read('quiz_attempts', 'id, user_id, quiz_id, topic_id, status, score, max_score, teacher_grade, teacher_quiz_snapshot, started_at, completed_at'),
      ]);
      const byId = (rows: any[]) => new Map(rows.map(row => [row.id, row]));
      const userMap = byId(users), courseMap = byId(courses), teacherTestMap = byId(teacherTests);
      const topicMap = byId(topics), topicTestMap = byId(topicTests);
      const profile = (id: string) => {
        const user = userMap.get(id);
        return { id, name: user?.name || 'Account unavailable', email: user?.email || '', role: user?.role || 'unknown' };
      };

      // A joined course is one relationship even if historical duplicate rows
      // exist. Keep the earliest recorded enrollment date for that relationship.
      const joined = new Map<string, any>();
      for (const row of enrollments) {
        const key = `${row.course_id}:${row.user_id}`;
        const existing = joined.get(key);
        if (!existing || (row.enrolled_at && (!existing.enrolled_at || row.enrolled_at < existing.enrolled_at))) joined.set(key, row);
      }
      const membership = [...joined.values()];
      const learnerIds = new Set<string>([...membership.map(row => row.user_id), ...attempts.map(row => row.user_id)]);
      const teacherIds = new Set<string>([
        ...users.filter(user => user.role === 'teacher').map(user => user.id),
        ...courses.map(course => course.created_by),
        ...teacherTests.filter(test => !courseMap.has(test.course_id)).map(test => test.teacher_id),
      ].filter(Boolean));
      const learnerCounts = new Map<string, number>(), testCounts = new Map<string, number>();
      for (const row of membership) learnerCounts.set(row.course_id, (learnerCounts.get(row.course_id) || 0) + 1);
      for (const test of [...teacherTests, ...topicTests.map(test => ({ ...test, course_id: topicMap.get(test.topic_id)?.course_id }))]) {
        if (test.course_id) testCounts.set(test.course_id, (testCounts.get(test.course_id) || 0) + 1);
      }
      const results = summarizeResults(attempts);
      return {
        summary: {
          totalTeachers: users.filter(user => user.role === 'teacher').length,
          totalStudents: new Set(membership.map(row => row.user_id)).size,
          totalCourses: courses.length,
          totalTests: teacherTests.length + topicTests.length,
          completedAttempts: attempts.filter(attempt => attempt.status === 'completed').length,
          averageScore: results.avgScore, passRate: results.passRate, pendingReviews: results.pendingReviews,
        },
        teachers: [...teacherIds].map(profile).sort((a, b) => a.name.localeCompare(b.name)),
        students: [...learnerIds].map(profile),
        courses: courses.map(course => ({ id: course.id, title: course.title, teacherId: course.created_by || null,
          published: course.is_published, studentCount: learnerCounts.get(course.id) || 0, testCount: testCounts.get(course.id) || 0 })),
        enrollments: membership.map(row => ({ id: row.id, courseId: row.course_id, studentId: row.user_id, joinedAt: row.enrolled_at })),
        attempts: attempts.map(attempt => {
          const isTopic = !!attempt.topic_id;
          const test = isTopic ? topicTestMap.get(attempt.quiz_id) : teacherTestMap.get(attempt.quiz_id);
          const topic = isTopic ? topicMap.get(attempt.topic_id) : null;
          const courseId = isTopic ? topic?.course_id : test?.course_id;
          const course = courseMap.get(courseId);
          // Reassigned courses belong to their current teacher; a historical
          // exam author must not be mistaken for the current course teacher.
          const teacherId = course?.created_by || (!course && !isTopic ? test?.teacher_id : null) || null;
          const teacher = teacherId ? profile(teacherId) : null;
          const student = profile(attempt.user_id);
          const percentage = finalResultPercentage(attempt);
          return {
            id: attempt.id, studentId: attempt.user_id, studentName: student.name, studentEmail: student.email,
            teacherId, teacherName: teacher?.name || 'Unassigned teacher', teacherEmail: teacher?.email || '',
            courseId: courseId || null, courseTitle: course?.title || 'Course unavailable',
            testId: attempt.quiz_id, testTitle: test?.title || 'Test unavailable', testType: isTopic ? 'Topic test' : 'Teacher test',
            topicTitle: topic?.title || null, status: attempt.status,
            percentage: percentage === null ? null : Math.round(percentage * 10) / 10,
            gradeSource: attempt.status !== 'completed' ? 'in_progress' : percentage === null ? 'pending'
              : attempt.teacher_grade !== null && attempt.teacher_grade !== undefined ? 'teacher' : 'automatic',
            startedAt: attempt.started_at, completedAt: attempt.completed_at,
            referenceIssues: [!userMap.has(attempt.user_id) && 'Student unavailable', !test && 'Test unavailable',
              !course && 'Course unavailable', isTopic && !topic && 'Topic unavailable',
              isTopic && test && topic && test.topic_id !== topic.id && 'Test/topic mismatch'].filter(Boolean),
          };
        }).sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || ''))),
      };
    } catch (error) {
      throw Object.assign(new Error('Administrator learning activity could not be loaded. Please retry.'), { statusCode: 503, cause: error });
    }
  },
};
