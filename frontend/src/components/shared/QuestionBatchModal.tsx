import { useRef, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

type TopicOption = { _id: string; title: string; courseName?: string };
export type BankQuestion = {
  _id: string; text: string; options: string[]; correctAnswer: number | null;
  difficulty: string; topicId: string | null; explanation?: string; topicName?: string;
  courseName?: string; questionType?: string; correctAnswers?: string[]; answerText?: string;
};
type Draft = {
  id: string;
  topicId: string;
  questionText: string;
  questionType: 'multipleChoice' | 'shortAnswer';
  options: string[];
  correctAnswer: number;
  acceptedAnswers: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  explanation: string;
};
const newDraft = (topicId: string): Draft => ({
  id: crypto.randomUUID(), topicId, questionText: '', questionType: 'multipleChoice',
  options: ['', '', '', ''], correctAnswer: 0, acceptedAnswers: '', difficulty: 'Medium', explanation: '',
});

export default function QuestionBatchModal({ topics, initialTopicId, editingQuestion, onClose, onSaved }: {
  topics: TopicOption[]; initialTopicId: string; editingQuestion?: BankQuestion | null; onClose: () => void; onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() => editingQuestion ? [{
    id: editingQuestion._id, topicId: editingQuestion.topicId || '', questionText: editingQuestion.text,
    questionType: editingQuestion.questionType === 'shortAnswer' ? 'shortAnswer' : 'multipleChoice',
    options: editingQuestion.options.length ? editingQuestion.options : ['', '', '', ''],
    correctAnswer: editingQuestion.correctAnswer ?? 0,
    acceptedAnswers: (editingQuestion.correctAnswers || (editingQuestion.answerText ? [editingQuestion.answerText] : [])).join('\n'),
    difficulty: editingQuestion.difficulty as Draft['difficulty'], explanation: editingQuestion.explanation || '',
  }] : [newDraft(initialTopicId)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const update = (id: string, values: Partial<Draft>) => setDrafts(current => current.map(draft => draft.id === id ? { ...draft, ...values } : draft));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    setError(null);
    const questions = drafts.map(({ acceptedAnswers, ...draft }) => ({
      ...draft,
      questionText: draft.questionText.trim(),
      options: draft.questionType === 'multipleChoice' ? draft.options.map(option => option.trim()) : [],
      correctAnswers: draft.questionType === 'shortAnswer' ? acceptedAnswers.split('\n').map(answer => answer.trim()).filter(Boolean) : [],
    }));
    const invalid = questions.findIndex(question => !question.questionText || (!editingQuestion && !question.topicId)
      || (question.questionType === 'multipleChoice' && question.options.some(option => !option))
      || (question.questionType === 'shortAnswer' && !question.correctAnswers.length));
    if (invalid >= 0) { setError(`Complete question ${invalid + 1} before saving.`); return; }
    pending.current = true;
    setSaving(true);
    try {
      if (editingQuestion) {
        const question = questions[0];
        await api.put(`/courses/questions/${editingQuestion._id}`, {
          ...question,
          text: question.questionText,
          correctAnswer: question.questionType === 'shortAnswer' ? null : question.correctAnswer,
        });
      }
      else await api.post('/questions/batch', { questions });
      toast.success(editingQuestion ? 'Question updated.' : `${questions.length} question${questions.length === 1 ? '' : 's'} saved.`);
      onSaved();
    } catch (error: any) {
      setError(error.response?.data?.error?.message || error.response?.data?.message || 'Unable to save questions. Your draft is unchanged; please retry.');
    } finally { pending.current = false; setSaving(false); }
  };

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="question-batch-title" className="mx-auto my-4 max-w-3xl rounded-xl bg-white p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="question-batch-title" className="text-xl font-semibold text-gray-900">{editingQuestion ? 'Edit question' : 'Add questions'}</h2>
        <button type="button" disabled={saving} onClick={onClose} className="rounded px-3 py-2 text-gray-600 disabled:opacity-50">Cancel</button>
      </div>
      <form onSubmit={save} className="space-y-5">
        <fieldset disabled={saving} className="space-y-5">
          {drafts.map((draft, index) => <fieldset key={draft.id} className="rounded-lg border border-gray-200 p-4" aria-label={`Question ${index + 1}`}>
            <legend className="px-2 font-semibold text-gray-900">Question {index + 1}</legend>
            {!editingQuestion && <div className="mb-3 flex justify-end">
              <button type="button" disabled={drafts.length === 1} aria-label={`Remove question ${index + 1}`} onClick={() => setDrafts(current => current.filter(question => question.id !== draft.id))} className="text-sm text-red-600 disabled:opacity-40">Remove</button>
            </div>}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-gray-700">Topic
                {editingQuestion && !draft.topicId ? <input value="Standalone" readOnly className="input-field mt-1" aria-label="Topic" /> : <select value={draft.topicId} disabled={Boolean(editingQuestion)} onChange={event => update(draft.id, { topicId: event.target.value })} className="input-field mt-1" required>
                  {topics.map(topic => <option key={topic._id} value={topic._id}>{topic.title}{topic.courseName ? ` (${topic.courseName})` : ''}</option>)}
                </select>}
              </label>
              <label className="text-sm text-gray-700">Type
                <select value={draft.questionType} onChange={event => update(draft.id, { questionType: event.target.value as Draft['questionType'] })} className="input-field mt-1">
                  <option value="multipleChoice">Multiple choice</option><option value="shortAnswer">Short answer</option>
                </select>
              </label>
              <label className="text-sm text-gray-700">Difficulty
                <select value={draft.difficulty} onChange={event => update(draft.id, { difficulty: event.target.value as Draft['difficulty'] })} className="input-field mt-1">
                  <option>Easy</option><option>Medium</option><option>Hard</option>
                </select>
              </label>
            </div>
            <label className="mt-4 block text-sm text-gray-700">Question text
              <textarea required maxLength={10000} rows={2} value={draft.questionText} onChange={event => update(draft.id, { questionText: event.target.value })} className="input-field mt-1" />
            </label>
            {draft.questionType === 'multipleChoice' ? <fieldset className="mt-4 space-y-2">
              <legend className="mb-2 text-sm text-gray-700">Options — select the correct answer</legend>
              {draft.options.map((option, optionIndex) => <div key={optionIndex} className="flex items-center gap-3">
                <input type="radio" name={`answer-${draft.id}`} checked={draft.correctAnswer === optionIndex} onChange={() => update(draft.id, { correctAnswer: optionIndex })} aria-label={`Correct option ${optionIndex + 1}`} />
                <input required maxLength={2000} value={option} onChange={event => update(draft.id, { options: draft.options.map((value, i) => i === optionIndex ? event.target.value : value) })} aria-label={`Option ${optionIndex + 1}`} placeholder={`Option ${optionIndex + 1}`} className="input-field" />
              </div>)}
            </fieldset> : <label className="mt-4 block text-sm text-gray-700">Accepted answers (one per line)
              <textarea required rows={3} value={draft.acceptedAnswers} onChange={event => update(draft.id, { acceptedAnswers: event.target.value })} className="input-field mt-1" />
            </label>}
            <label className="mt-4 block text-sm text-gray-700">Explanation (optional)
              <textarea maxLength={10000} rows={2} value={draft.explanation} onChange={event => update(draft.id, { explanation: event.target.value })} className="input-field mt-1" />
            </label>
          </fieldset>)}
          {!editingQuestion && <button type="button" disabled={drafts.length >= 100} onClick={() => setDrafts(current => [...current, newDraft(current[current.length - 1].topicId)])} className="rounded-lg border border-primary-300 px-4 py-2 font-medium text-primary-700 disabled:opacity-50">Add another question</button>}
        </fieldset>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end border-t border-gray-100 pt-4">
          <button type="submit" disabled={saving} className="rounded-lg bg-primary-700 px-5 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : editingQuestion ? 'Update question' : `Save ${drafts.length} question${drafts.length === 1 ? '' : 's'}`}</button>
        </div>
      </form>
    </section>
  </div>;
}
