import express from 'express';
import { getDatabase } from '../config/database.js';
import { LIMITS, isPositiveIntId } from '../config/security.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const quizzes = await db.all('SELECT * FROM quizzes ORDER BY id ASC');
    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!isPositiveIntId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid quiz id' });
    }
    const quizId = Number(req.params.id);

    const db = await getDatabase();
    const quiz = await db.get('SELECT * FROM quizzes WHERE id = ?', [quizId]);

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // The answer key never leaves the server: only the question and its options
    // are sent, so a quiz cannot be solved by reading the endpoint.
    const questions = await db.all(
      'SELECT id, question, options FROM questions WHERE quiz_id = ?',
      [quizId]
    );

    const parsedQuestions = questions.map((q) => ({
      ...q,
      options: JSON.parse(q.options)
    }));

    res.json({ ...quiz, questions: parsedQuestions });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    if (!isPositiveIntId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid quiz id' });
    }
    const quizId = Number(req.params.id);

    const answers = req.body?.answers;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers must be an array' });
    }
    // Reject absurdly large answer sheets up front so the per-question checks
    // below always run over a bounded array.
    if (answers.length > LIMITS.answerItems) {
      return res.status(400).json({ error: 'Too many answers' });
    }
    // Every element must be a plain string — never an object (e.g.
    // { "$ne": ... }), array, number or nested structure.
    if (answers.some((a) => typeof a !== 'string')) {
      return res.status(400).json({ error: 'Each answer must be a string' });
    }

    const db = await getDatabase();
    const quiz = await db.get('SELECT id FROM quizzes WHERE id = ?', [quizId]);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questions = await db.all(
      'SELECT id, question, correct_answer, options FROM questions WHERE quiz_id = ?',
      [quizId]
    );

    if (answers.length !== questions.length) {
      return res.status(400).json({ error: 'Please answer every question' });
    }
    if (questions.length === 0) {
      return res.status(404).json({ error: 'This quiz has no questions yet' });
    }

    // Grading happens here, against the stored key — the client never sees it.
    let correct = 0;
    const results = questions.map((q, idx) => {
      const userAnswer = answers[idx];
      const isCorrect = userAnswer === q.correct_answer;
      if (isCorrect) correct++;

      return {
        questionId: q.id,
        question: q.question,
        userAnswer,
        correctAnswer: q.correct_answer,
        isCorrect
      };
    });

    res.json({
      score: correct,
      total: questions.length,
      percentage: Math.round((correct / questions.length) * 100),
      results
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

export default router;
