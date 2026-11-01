import { canReleaseStudentResult } from './resultReleasePolicy';

interface ResultAttempt {
  status?: string;
  topic_id?: unknown;
  teacher_grade?: unknown;
  score?: unknown;
  max_score?: unknown;
}

// A teacher's published percentage is the final grade. Keep the original
// automatic marks intact for answer review, but never use them in place of a
// subsequent teacher decision (including a legitimate grade of zero).
export function finalResultPercentage(attempt: ResultAttempt): number | null {
  if (!canReleaseStudentResult(attempt)) return null;
  const grade = attempt.teacher_grade;
  if (typeof grade === 'number' && Number.isFinite(grade) && grade >= 0 && grade <= 100) return grade;
  if (!attempt.topic_id) return null;
  const { score, max_score: maxScore } = attempt;
  return typeof score === 'number' && Number.isFinite(score) && score >= 0
    && typeof maxScore === 'number' && Number.isFinite(maxScore) && maxScore > 0 && score <= maxScore
    ? score / maxScore * 100 : null;
}

export function summarizeResults(attempts: ResultAttempt[]) {
  const completed = attempts.filter(attempt => attempt.status === 'completed');
  const scores = completed.map(finalResultPercentage).filter((score): score is number => score !== null);
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    scores,
    reviewedAttempts: scores.length,
    pendingReviews: completed.length - scores.length,
    avgScore: scores.length ? round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    passRate: scores.length ? round(scores.filter(score => score >= 60).length / scores.length * 100) : null,
  };
}
