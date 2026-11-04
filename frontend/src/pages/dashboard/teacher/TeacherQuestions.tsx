import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DataTable } from '../../../components/shared';
import QuestionBatchModal, { type BankQuestion } from '../../../components/shared/QuestionBatchModal';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

type QuestionWithMeta = BankQuestion;

interface TopicOption {
  _id: string;
  title: string;
  courseName?: string;
}

const TeacherQuestions = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const returnHandoffHandled = useRef(false);
  const [questions, setQuestions] = useState<QuestionWithMeta[]>([]);
  const [topics, setTopics] = useState<TopicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionWithMeta | null>(null);
  const [initialTopicId, setInitialTopicId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [questionsRes, topicsRes] = await Promise.all([
        api.get('/courses/teacher/questions'),
        api.get('/courses/teacher/topics'),
      ]);
      setQuestions(questionsRes.data.data || []);
      setTopics(topicsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoadError('Questions and topics could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (loading || returnHandoffHandled.current || params.get('create') !== '1') return;

    const requestedTopic = topics.find((topic) => topic._id === params.get('topicId'));
    if (!requestedTopic) return;

    returnHandoffHandled.current = true;
    setEditingQuestion(null);
    setInitialTopicId(requestedTopic._id);
    setModalOpen(true);
    params.delete('create');
    params.delete('topicId');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [loading, location.pathname, location.search, navigate, topics]);

  const startTopicFirstWorkflow = () => {
    toast('Create a topic, then you will return here to add its first question.');
    navigate('/dashboard/teacher/topics?returnTo=/dashboard/teacher/questions');
  };

  const handleOpenModal = (question?: QuestionWithMeta) => {
    if (!question && topics.length === 0) {
      startTopicFirstWorkflow();
      return;
    }
    
    setEditingQuestion(question || null);
    setInitialTopicId(question?.topicId || (selectedTopic === 'all' ? topics[0]?._id || '' : selectedTopic));
    setModalOpen(true);
  };

  const handleDelete = async (question: QuestionWithMeta) => {
    if (!confirm(`Delete this question?`)) return;
    
    try {
      await api.delete(`/courses/questions/${question._id}`);
      toast.success('Question deleted');
      setQuestions(questions.filter((q) => q._id !== question._id));
    } catch (error) {
      toast.error('Failed to delete question');
    }
  };

  const getDifficultyBadge = (difficulty: string) => {
    const styles: Record<string, string> = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[difficulty] || 'bg-gray-100 text-gray-800'}`}>
        {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
      </span>
    );
  };

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTopic = selectedTopic === 'all' || q.topicId === selectedTopic;
    const matchesDifficulty = selectedDifficulty === 'all' || q.difficulty.toLowerCase() === selectedDifficulty;
    return matchesSearch && matchesTopic && matchesDifficulty;
  });

  const columns = [
    {
      key: 'text' as keyof QuestionWithMeta,
      header: 'Question',
      render: (q: QuestionWithMeta) => (
        <div className="max-w-md">
          <p className="text-gray-900 line-clamp-2">{q.text}</p>
          <p className="text-sm text-gray-500 mt-1">{q.topicName}</p>
        </div>
      ),
    },
    {
      key: 'difficulty' as keyof QuestionWithMeta,
      header: 'Difficulty',
      render: (q: QuestionWithMeta) => getDifficultyBadge(q.difficulty.toLowerCase()),
    },
    {
      key: 'options' as keyof QuestionWithMeta,
      header: 'Options',
      render: (q: QuestionWithMeta) => (
        <span className="text-gray-600">{q.questionType === 'shortAnswer' ? 'Short answer' : `${q.options.length} options`}</span>
      ),
    },
    {
      key: 'correctAnswer' as keyof QuestionWithMeta,
      header: 'Answer',
      render: (q: QuestionWithMeta) => (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircleIcon className="h-4 w-4" />
          <span className="max-w-xs truncate text-sm">{q.questionType === 'shortAnswer' ? (q.correctAnswers?.join(', ') || q.answerText) : `Option ${(q.correctAnswer ?? 0) + 1}`}</span>
        </div>
      ),
    },
    {
      key: '_id' as keyof QuestionWithMeta,
      header: 'Actions',
      render: (q: QuestionWithMeta) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenModal(q)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => handleDelete(q)}
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Questions</h1>
          <p className="text-sm text-gray-500 mt-1">Manage exam questions for your topics</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg font-medium hover:bg-primary-800 transition-colors"
        >
          <PlusIcon className="h-5 w-5" />
          Add Questions
        </button>
      </header>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Topics</option>
            {topics.map((topic) => (
              <option key={topic._id} value={topic._id}>
                {topic.title}
              </option>
            ))}
          </select>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Questions Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {loadError ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 mb-4">{loadError}</p>
            <button onClick={fetchData} className="text-primary-600 hover:text-primary-800 font-medium">
              Retry
            </button>
          </div>
        ) : topics.length === 0 && questions.length === 0 && !loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">You need to create topics before adding questions.</p>
            <button onClick={startTopicFirstWorkflow} className="text-primary-600 hover:text-primary-800 font-medium">
              Create a topic, then add a question →
            </button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredQuestions}
            isLoading={loading}
            emptyMessage="No questions found. Click 'Add Questions' to create your first questions!"
          />
        )}
      </div>

      {modalOpen && <QuestionBatchModal
        key={editingQuestion?._id || 'new'}
        topics={topics}
        initialTopicId={initialTopicId}
        editingQuestion={editingQuestion}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); void fetchData(); }}
      />}

    </div>
  );
};

export default TeacherQuestions;
