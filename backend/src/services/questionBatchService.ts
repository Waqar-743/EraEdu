import { z } from 'zod';
import { supabase } from '../config/supabase';
import { questionService } from './questionService';

const questionInput = z.object({
  id: z.uuid(),
  topicId: z.uuid(),
  questionText: z.string().trim().min(1).max(10000),
  questionType: z.enum(['multipleChoice', 'shortAnswer']),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  options: z.array(z.string().trim().min(1).max(2000)).max(10).default([]),
  correctAnswer: z.number().int().optional(),
  correctAnswers: z.array(z.string().trim().min(1).max(2000)).max(50).default([]),
  explanation: z.string().trim().max(10000).default(''),
}).superRefine((question, ctx) => {
  if (question.questionType === 'multipleChoice' && (question.options.length < 2
    || question.correctAnswer === undefined || question.correctAnswer < 0 || question.correctAnswer >= question.options.length)) {
    ctx.addIssue({ code: 'custom', message: 'Enter at least two options and select the correct answer.' });
  }
  if (question.questionType === 'shortAnswer' && !question.correctAnswers.length) {
    ctx.addIssue({ code: 'custom', message: 'Enter at least one accepted answer.' });
  }
});

const batchInput = z.array(questionInput).min(1).max(100).superRefine((questions, ctx) => {
  if (new Set(questions.map(question => question.id)).size !== questions.length) {
    ctx.addIssue({ code: 'custom', message: 'Each question must have a different ID.' });
  }
});
const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

export async function createQuestionBatch(input: unknown, userId: string, role: string) {
  const parsed = batchInput.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const item = typeof issue.path[0] === 'number' ? `Question ${issue.path[0] + 1}: ` : '';
    throw fail(item + issue.message, 400);
  }
  for (const topicId of new Set(parsed.data.map(question => question.topicId))) {
    await questionService.assertTopicAccess(topicId, userId, role);
  }
  const rows = parsed.data.map(question => ({
    id: question.id,
    topic_id: question.topicId,
    content: question.questionText,
    question_type: question.questionType,
    options: question.questionType === 'multipleChoice' ? question.options : [],
    correct_answer: question.questionType === 'multipleChoice' ? question.correctAnswer! : null,
    correct_answers: question.questionType === 'shortAnswer' ? question.correctAnswers : [],
    explanation: question.explanation,
    difficulty: question.difficulty,
    created_by: userId,
  }));
  // One INSERT is atomic: a bad row cannot leave a half-saved batch. Stable
  // client IDs also make a retry after a lost response safe without a migration.
  const { data, error } = await supabase.from('questions').insert(rows).select('*');
  if (!error) {
    if (!Array.isArray(data) || data.length !== rows.length) throw fail('Question save could not be confirmed. Retry the same batch.', 503);
    return data;
  }
  if (error.code !== '23505') throw fail('Unable to save questions. Your draft is unchanged; please retry.', 503);

  const { data: existing, error: readError } = await supabase.from('questions').select('*')
    .eq('created_by', userId).in('id', rows.map(row => row.id));
  if (readError || !Array.isArray(existing)) throw fail('Question save could not be confirmed. Retry the same batch.', 503);
  const identical = existing.length === rows.length && rows.every(row => {
    const saved = existing.find(question => question.id === row.id);
    return saved && Object.entries(row).every(([key, value]) => JSON.stringify(saved[key]) === JSON.stringify(value));
  });
  if (!identical) throw fail('This draft conflicts with saved questions. Refresh the question bank before retrying.', 409);
  return existing;
}
