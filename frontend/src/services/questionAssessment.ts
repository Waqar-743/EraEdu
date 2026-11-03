interface QuestionAssessmentDraft {
  questionTitle: string;
  description: string;
  courseId: string;
  questionScheduledStart: string;
  cameraMonitoring: boolean;
  violationLimit: number;
  questions: {
    text: string;
    difficulty: string;
    explanation?: string;
    timeLimit: number;
  }[];
}

interface AssessmentBankQuestion {
  _id: string;
  courseId: string | null;
  topicId: string | null;
  questionType: string;
  timeLimit?: number;
}

export function buildQuestionAssessmentPayload(
  draft: QuestionAssessmentDraft,
  selectedBankIds: string[],
  bankQuestions: AssessmentBankQuestion[],
) {
  if (!draft.courseId) throw new Error('Please select a course');
  if (!draft.questionTitle.trim()) throw new Error('Title is required');
  if (!draft.questions.length && !selectedBankIds.length) {
    throw new Error('Add a question or select one from the bank');
  }
  if (draft.questions.some((question) => !question.text.trim())) {
    throw new Error('All questions must have text');
  }
  if (new Set(selectedBankIds).size !== selectedBankIds.length) {
    throw new Error('Select each bank question only once');
  }

  const byId = new Map(bankQuestions.map((question) => [question._id, question]));
  const selectedQuestions = selectedBankIds.map((id) => {
    const question = byId.get(id);
    if (!question || question.courseId !== draft.courseId || !question.topicId) {
      throw new Error('Selected bank questions are unavailable for this course. Refresh the bank and select them again.');
    }
    if (!['multipleChoice', 'shortAnswer'].includes(question.questionType)) {
      throw new Error('Only multiple-choice and short-answer bank questions can be added.');
    }
    return question;
  });
  const totalSeconds = [...draft.questions, ...selectedQuestions]
    .reduce((sum, question) => sum + (question.timeLimit || 60), 0);

  return {
    title: draft.questionTitle.trim(),
    description: draft.description || 'Question assessment',
    courseId: draft.courseId,
    scheduledStart: draft.questionScheduledStart.trim()
      ? new Date(draft.questionScheduledStart).toISOString()
      : null,
    timeLimit: Math.max(1, Math.ceil(totalSeconds / 60)),
    cameraMonitoring: draft.cameraMonitoring,
    violationLimit: draft.violationLimit,
    // The server loads and snapshots bank questions, including their answer keys.
    bankQuestionIds: [...selectedBankIds],
    questions: draft.questions.map((question) => ({
      text: question.text,
      options: [],
      correctAnswer: -1,
      questionType: 'shortAnswer',
      difficulty: question.difficulty,
      explanation: question.explanation,
      timeLimit: question.timeLimit || 60,
    })),
  };
}
