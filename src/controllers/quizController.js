import asyncHandler from "express-async-handler";
import Quiz from "../models/quiz.js";
import Question from "../models/question.js";
import Course from "../models/courseModel.js";
import QuizAttempt from "../models/quizAttempt.js";
import mongoose from "mongoose";

export const createQuiz = asyncHandler(async (req, res) => {
  const { title, courseId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    res.status(400);
    throw new Error("Invalid Course ID");
  }

  // Check if the parent course exists
  const course = await Course.findById(courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  const quiz = new Quiz({
    title,
    course: courseId,
  });

  const createdQuiz = await quiz.save();
  res.status(201).json(createdQuiz);
});

export const addQuestionToQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  const { text, options, correctAnswer } = req.body;

  if (!mongoose.Types.ObjectId.isValid(quizId)) {
    res.status(400);
    throw new Error("Invalid Quiz ID");
  }

  // Check if the parent quiz exists
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    res.status(404);
    throw new Error("Quiz not found");
  }

  const question = new Question({
    quiz: quizId,
    text,
    options,
    correctAnswer,
  });

  const createdQuestion = await question.save();
  res.status(201).json(createdQuestion);
});

// @desc    Get all quizzes for a course
// @route   GET /api/v1/quizzes/course/:courseId
// @access  Private (Subscribed)
export const getQuizzesForCourse = asyncHandler(async (req, res) => {
  // We check subscription status from our paywall middleware
  if (!req.user.isSubscribed) {
    res.status(403);
    throw new Error("Not authorized. Subscription required for quizzes.");
  }

  const quizzes = await Quiz.find({ course: req.params.courseId });
  res.json(quizzes);
});

// @desc    Get a single quiz's questions
// @route   GET /api/v1/quizzes/:quizId/questions
// @access  Private (Subscribed)
export const getQuizQuestions = asyncHandler(async (req, res) => {
  if (!req.user.isSubscribed) {
    res.status(403);
    throw new Error("Not authorized. Subscription required for quizzes.");
  }

  // Find questions BUT hide the correct answer
  const questions = await Question.find({ quiz: req.params.quizId }).select(
    "-correctAnswer"
  );

  res.json(questions);
});

export const submitQuiz = asyncHandler(async (req, res) => {
  if (!req.user.isSubscribed) {
    res.status(403);
    throw new Error("Not authorized. Subscription required.");
  }

  const { quizId } = req.params;
  const userAnswers = req.body.answers; // Expecting: [{ questionId: '...', userAnswer: '...' }]

  // 1. Get all correct answers for this quiz from the DB
  const allQuestions = await Question.find({ quiz: quizId });

  let score = 0;
  let detailedResults = [];

  // 2. Grade the quiz
  for (const question of allQuestions) {
    const userAnswer = userAnswers.find(
      (ans) => ans.questionId === question._id.toString()
    );

    const isCorrect =
      userAnswer && userAnswer.userAnswer === question.correctAnswer;

    if (isCorrect) {
      score++;
    }

    detailedResults.push({
      question: question._id,
      userAnswer: userAnswer ? userAnswer.userAnswer : null,
      correctAnswer: question.correctAnswer,
      isCorrect: isCorrect,
    });
  }

  // 3. Save the attempt to the database
  const quizAttempt = new QuizAttempt({
    user: req.user._id,
    quiz: quizId,
    score: score,
    totalQuestions: allQuestions.length,
    answers: detailedResults,
  });

  const savedAttempt = await quizAttempt.save();

  // 4. Send the final score and results
  res.status(201).json(savedAttempt);
});
