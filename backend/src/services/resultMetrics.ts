interface ResultAttempt {
  status?: string;
  topic_id?: unknown;
  teacher_grade?: unknown;
  score?: unknown;
  max_score?: unknown;
  teacher_quiz_snapshot?: unknown;
}

function hasAutomaticTeacherScore(attempt: ResultAttempt): boolean {
  const snapshot = attempt.teacher_quiz_snapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  const questions = (snapshot as { questions?: unknown }).questions;
  // Use the immutable attempt snapshot, never the current exam: its questions
  // may have been edited after completion. An empty/missing/legacy snapshot
  // cannot establish that every question was automatically marked.
  return Array.isArray(questions) && questions.length > 0 && attempt.max_score === questions.length
    && questions.every(question => question && typeof question === 'object'
      && (question.questionType === undefined || question.questionType === 'multipleChoice')
      && Array.isArray(question.options) && question.options.length >= 2
      && Number.isInteger(question.correctAnswer) && question.correctAnswer >= 0
      && question.correctAnswer < question.options.length);
}

// A teacher's published percentage is the final grade. Keep the original
// automatic marks intact for answer review, but never use them in place of a
// subsequent teacher decision (including a legitimate grade of zero).
// Completed all-MCQ exams have an authoritative automatic score immediately;
// short/mixed-answer exams still need a teacher's final percentage. Aggregate
// eligibility does not release answer keys or question-by-question feedback.
export function finalResultPercentage(attempt: ResultAttempt): number | null {
  if (attempt.status !== 'completed') return null;
  const grade = attempt.teacher_grade;
  if (typeof grade === 'number' && Number.isFinite(grade) && grade >= 0 && grade <= 100) return grade;
  if (grade !== null && grade !== undefined) return null;
  if (!attempt.topic_id && !hasAutomaticTeacherScore(attempt)) return null;
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
