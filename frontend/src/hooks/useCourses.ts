import { useState, useCallback, useRef } from 'react';
import api from '../services/api';
import { Course, Topic } from '../types';
import toast from 'react-hot-toast';

export const useCourses = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const enrollmentPending = useRef(false);
  const courseRequest = useRef(0);
  const enrolledRequest = useRef(0);
  const enrolledLoaded = useRef(false);
  const activeCourseId = useRef<string>();
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const fetchCourses = useCallback(async (params?: any) => {
    setLoading(true);
    try {
      const response = await api.get('/courses', { params });
      setCourses(response.data.data);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCourseById = useCallback(async (id: string, preserveCurrent = false) => {
    const request = ++courseRequest.current;
    const sameCourse = activeCourseId.current === id;
    activeCourseId.current = id;
    if (!preserveCurrent || !sameCourse) setLoading(true);
    setError(null);
    if (!preserveCurrent || !sameCourse) {
      setCurrentCourse(null);
      setTopics([]);
    }
    try {
      const response = await api.get(`/courses/${id}`);
      const course: Course = response.data.data;
      if (typeof course.isEnrolled !== 'boolean' || typeof course.canViewTopics !== 'boolean') {
        throw new Error('Course enrollment state is unavailable. Please retry.');
      }
      let visibleTopics: Topic[] = [];
      if (course.canViewTopics) {
        const topicsResponse = await api.get(`/courses/${id}/topics`);
        visibleTopics = topicsResponse.data.data;
        if (!Array.isArray(visibleTopics)) throw new Error('Course topics are unavailable. Please retry.');
      }
      if (request !== courseRequest.current) return;
      setCurrentCourse(course);
      setTopics(visibleTopics);
      setError(null);
    } catch (err: any) {
      if (request !== courseRequest.current) return;
      // A successful earlier fetch cannot authorize content after the server
      // revokes enrollment, unpublishes/deletes a course, or rejects the session.
      if ([401, 403, 404].includes(err.response?.status)) {
        setCurrentCourse(null);
        setTopics([]);
      }
      setError(err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Failed to fetch course details');
    } finally {
      if (request === courseRequest.current) setLoading(false);
    }
  }, []);

  const enrollInCourse = useCallback(async (courseId: string) => {
    if (enrollmentPending.current) return;
    enrollmentPending.current = true;
    setEnrolling(true);
    setError(null);
    try {
      const response = await api.post(`/courses/${courseId}/enroll`);
      if (response.data.data?.isEnrolled !== true) throw new Error('Enrollment confirmation is unavailable. Please retry.');
      toast.success(response.data.data.alreadyEnrolled ? 'Already enrolled' : 'Enrolled successfully!');
      // Navigation may finish before enrollment does. Do not put the previous
      // course back into the details view of a different course.
      if (activeCourseId.current === courseId) {
        setCurrentCourse(previous => previous ? { ...previous, isEnrolled: true } : previous);
        await fetchCourseById(courseId, true);
      }
    } catch (err: any) {
      const message = err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Failed to enroll';
      toast.error(message);
      if (activeCourseId.current === courseId) setError(message);
    } finally {
      enrollmentPending.current = false;
      setEnrolling(false);
    }
  }, [fetchCourseById]);

  const fetchEnrolledCourses = useCallback(async (preserveCurrent = false) => {
    const request = ++enrolledRequest.current;
    if (!preserveCurrent || !enrolledLoaded.current) setLoading(true);
    try {
      const response = await api.get('/courses/my/enrolled');
      const rows: Course[] = response.data.data;
      if (!Array.isArray(rows) || rows.some(row => !Number.isSafeInteger(row.topicsCount) || row.topicsCount! < 0)) {
        throw new Error('The enrolled-course response is missing topic counts. Please retry.');
      }
      if (request !== enrolledRequest.current) return;
      enrolledLoaded.current = true;
      setCourses(rows);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err: any) {
      if (request !== enrolledRequest.current) return;
      if (!preserveCurrent) setCourses([]);
      setError(err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Failed to fetch enrolled courses');
    } finally {
      if (request === enrolledRequest.current) setLoading(false);
    }
  }, []);

  return {
    courses,
    currentCourse,
    topics,
    loading,
    error,
    enrolling,
    pagination,
    fetchCourses,
    fetchCourseById,
    enrollInCourse,
    fetchEnrolledCourses,
  };
};
