import { useState, useEffect } from 'react';
import { Sprout, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import PageHeader from '../components/PageHeader';
import Reveal from '../components/Reveal';

export default function QuizPage() {
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const quizzes = await api.get('/quiz');
        if (!quizzes || quizzes.length === 0) {
          if (!cancelled) setError('No quizzes available yet.');
          return;
        }
        // Use the first available quiz.
        const target = quizzes[0];
        const detail = await api.get(`/quiz/${target.id}`);
        if (cancelled) return;
        setQuiz(detail);
        setQuestions(detail.questions || []);
      } catch (err) {
        if (!cancelled) setError('Could not load the quiz right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const answered = selected !== null;
  const correct = submitted ? submitted.results?.[selected]?.isCorrect : false;

  const handleSelect = (index) => {
    if (submitted) return;
    setSelected(index);
  };

  const handleSubmit = async (index) => {
    if (submitted || selected === null) return;
    setSubmitting(true);
    try {
      const answers = questions.map((_, i) => (i === index ? i : -1));
      // Submit the full answer sheet; the server grades every question.
      const result = await api.post(`/quiz/${quiz.id}/submit`, { answers });
      if (!quiz) return;
      setSubmitted(result);
    } catch {
      setError('Could not submit your answers.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          eyebrow="EcoSense quiz"
          title="Sharpen your eye for the wild"
          subtitle="Loading the field test…"
        />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-forest-500" />
        </div>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div>
        <PageHeader
          eyebrow="EcoSense quiz"
          title="Sharpen your eye for the wild"
          subtitle="The quiz isn't available right now."
        />
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6 lg:px-8 text-center">
          <p className="text-mist-600">{error || 'No quiz loaded.'}</p>
          <Link to="/education" className="mt-6 inline-flex items-center gap-2 text-forest-600 underline">
            Read the field notes instead
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const total = questions.length;
  const number = selected + 1;

  return (
    <div>
      <PageHeader
        eyebrow="EcoSense quiz"
        title="Sharpen your eye for the wild"
        subtitle={`A short field test on reading hazards — question ${number} of ${total}.`}
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6 lg:px-8">
        <Reveal>
          <div className="eco-card overflow-hidden">
            {/* question header */}
            <div className="border-b border-cream-200 bg-cream-100/60 px-7 py-6 sm:px-9">
              <div className="flex items-center justify-between gap-4">
                <p className="eyebrow">Field test · question {number} of {total}</p>
                <span className="chip">
                  {submitted ? 'Submitted' : 'Live'}
                </span>
              </div>
              <h2 className="mt-4 font-display text-2xl leading-snug sm:text-[1.7rem]">
                {questions[selected]?.question}
              </h2>
            </div>

            {/* options */}
            <div className="space-y-3 px-7 py-7 sm:px-9">
              {questions.map((question, i) => {
                const isSelected = selected === i;
                const isCorrect = submitted ? question.isCorrect : false;
                const isWrong = submitted && isSelected && !isCorrect;

                return (
                  <button
                    key={question.id}
                    onClick={() => handleSelect(i)}
                    disabled={submitted}
                    className={`flex w-full items-start gap-3.5 rounded-2xl border-2 px-5 py-4 text-left text-[0.95rem] font-medium transition-all duration-200 ${
                      submitted && isCorrect
                        ? 'border-leaf-500 bg-leaf-50 text-leaf-800'
                        : submitted && isWrong
                        ? 'border-[#efcdbf] bg-[#f7e5de] text-[#a8432e]'
                        : submitted
                        ? 'border-cream-200 bg-cream-50/50 text-mist-500'
                        : isSelected
                        ? 'border-forest-400 bg-forest-50/60 text-charcoal-800'
                        : 'border-cream-200 bg-cream-50 text-charcoal-800 hover:-translate-y-0.5 hover:border-forest-300 hover:shadow-soft cursor-pointer'
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-[0.65rem] font-bold ${
                        submitted && isCorrect
                          ? 'border-leaf-500 bg-leaf-500 text-cream-50 dark:text-[#fffdf7]'
                          : submitted && isWrong
                          ? 'border-[#bc4b33] bg-[#bc4b33] text-cream-50 dark:text-[#fffdf7]'
                          : isSelected
                          ? 'border-forest-500 bg-forest-500 text-cream-50 dark:text-[#fffdf7]'
                          : 'border-cream-400 text-transparent'
                      }`}
                    >
                      {submitted && isCorrect
                        ? '✓'
                        : submitted && isWrong
                        ? '✕'
                        : String.fromCharCode(65 + i)}
                    </span>
                    <span>{question.question}</span>
                  </button>
                );
              })}

              {submitted && (
                <div
                  className={`mt-5 flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm leading-relaxed ${
                    submitted.score !== undefined && submitted.score === total
                      ? 'border-[#c5dcc3] bg-[#e5efe0] text-[#3e6a3c]'
                      : 'border-[#efcdbf] bg-[#f7e5de] text-[#a8432e]'
                  }`}
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-bold">
                      {submitted.score === total
                        ? 'Well read — full marks.'
                        : `${submitted.score} of ${submitted.total} correct.`}
                    </p>
                    <p className="mt-1 opacity-90">
                      Sudden changes in colour or smell after rain usually point to a
                      discharge upstream. Photograph it, note the location, and leave a
                      report — quick action is what keeps a stream alive.
                    </p>
                  </div>
                </div>
              )}

              {!submitted && selected !== null && (
                <button
                  onClick={() => handleSubmit(selected)}
                  disabled={submitting}
                  className="mt-5 w-full rounded-xl border-2 border-forest-600 bg-forest-600 px-5 py-3 text-sm font-semibold text-cream-50 transition-all duration-200 hover:bg-forest-700 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-forest-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      Submit answer
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </Reveal>

        {/* results strip — shown after submission */}
        {submitted && submitted.percentage !== undefined && (
          <Reveal>
            <div className="mt-10 flex flex-col items-center gap-4 rounded-3xl border border-dashed border-forest-200 bg-forest-50/60 px-8 py-9 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <span className="text-4xl font-display font-bold text-forest-700">
                  {submitted.percentage}%
                </span>
                <span className="text-mist-600">
                  — {submitted.score} of {submitted.total} correct
                </span>
              </div>
              <Link to="/education" className="btn btn-soft shrink-0">
                Read the field notes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        )}

        {/* more-questions ribbon — only before submission */}
        {!submitted && (
          <Reveal>
            <div className="mt-10 flex flex-col items-center gap-5 rounded-3xl border border-dashed border-forest-200 bg-forest-50/60 px-8 py-9 text-center sm:flex-row sm:text-left">
              <Sprout className="h-11 w-auto shrink-0 text-forest-500 animate-sway-slow" />
              <div className="flex-1">
                <h2 className="text-2xl">More field tests are sprouting</h2>
                <p className="mx-auto mt-1.5 max-w-lg text-mist-600 sm:mx-0">
                  The full EcoSense quiz — scored, with gentle feedback after every
                  answer — grows from this seed.
                </p>
              </div>
              <Link to="/education" className="btn btn-soft shrink-0">
                Read the field notes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
