import mongoose from "mongoose";
import {
  withCache,
  TTL,
  cacheDel,
  cacheDelPattern,
  invalidateQuizCache,
  invalidateQuizListCache,
} from "../helper/cacheHelper.js";
import { findCourseBySlugOrId } from "../helper/courseHelper.js";
import { partitionQuestions, buildBulkSummary } from "../helper/quizHelper.js";
import * as repo from "../repository/quizRepository.js";

/* ============================================================
   Create Quiz (with optional questions) — transactional
============================================================ */
export const createQuizService = async (body, userId) => {
  const {
    title,
    slug,
    description,
    courseId,
    timeLimit,
    totalMarks,
    isPublished,
    isPremium,
    category,
    customCategory,
    allowMultipleAttempts,
    tags,
    quizType,
    questions,
  } = body;

  if (!title?.trim()) {
    return { status: 400, body: { message: "Title is required" } };
  }

  if (category === "Other" && !customCategory?.trim()) {
    return {
      status: 400,
      body: { message: "customCategory is required when category is 'Other'" },
    };
  }

  const effectiveType = courseId ? "course" : quizType || "standalone";

  if (quizType && courseId && quizType !== "course") {
    return {
      status: 400,
      body: {
        message: `quizType must be 'course' when courseId is provided, got '${quizType}'`,
      },
    };
  }
  if (quizType === "course" && !courseId) {
    return {
      status: 400,
      body: { message: "courseId is required when quizType is 'course'" },
    };
  }

  // Validate questions up-front — fail fast before any DB work
  const incomingQuestions = Array.isArray(questions) ? questions : [];
  const { valid: validQuestions, invalid: invalidQuestions } =
    partitionQuestions(incomingQuestions, null); // quizId filled in after creation

  if (invalidQuestions.length > 0) {
    return {
      status: 400,
      body: {
        message: "Quiz not created — one or more questions failed validation.",
        questionErrors: invalidQuestions.map(({ index, errors }) => ({
          index,
          errors,
        })),
      },
    };
  }

  const [course, existingQuiz] = await Promise.all([
    courseId ? findCourseBySlugOrId(courseId) : Promise.resolve(null),
    repo.findQuizByTitle(title, courseId, effectiveType),
  ]);

  if (courseId && !course) {
    return { status: 404, body: { message: "Course not found" } };
  }
  if (existingQuiz) {
    return {
      status: 400,
      body: {
        message: courseId
          ? "A quiz with this title already exists for this course."
          : `A ${effectiveType} quiz with this title already exists.`,
      },
    };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [quiz] = await repo.createQuizDb(
      {
        title: title.trim(),
        slug,
        description,
        course: course?._id || null,
        timeLimit: Number(timeLimit) || 0,
        totalMarks: Number(totalMarks) || 0,
        isPublished: isPublished ?? true,
        isPremium: isPremium ?? false,
        category: category || "General",
        customCategory: category === "Other" ? customCategory.trim() : null,
        quizType: effectiveType,
        allowMultipleAttempts: allowMultipleAttempts ?? true,
        tags: tags || [],
        createdBy: userId,
      },
      session,
    );

    let insertedQuestions = [];
    if (incomingQuestions.length > 0) {
      // Re-build docs now that we have quiz._id
      const { valid: docsWithId } = partitionQuestions(
        incomingQuestions,
        quiz._id,
      );
      insertedQuestions = await repo.insertManyQuestions(docsWithId, session);
    }

    await session.commitTransaction();
    session.endSession();
    await invalidateQuizListCache();

    return {
      status: 201,
      body: {
        quiz,
        questions: insertedQuestions,
        questionsAdded: insertedQuestions.length,
      },
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    if (err.code === 11000 && err.keyPattern?.slug) {
      return {
        status: 400,
        body: { message: "This slug is already taken. Please choose another." },
      };
    }
    throw err;
  }
};

/* ============================================================
   Get All Quizzes (with caching)
============================================================ */
export const getAllQuizzesService = async (query) => {
  const limit = Math.min(50, Number(query.limit) || 6);
  const quizType = query.type || "all";
  const page = Number(query.page) || 1;

  const cacheKey = `quizzes:list:${quizType}:${limit}:${page}`;

  const quizzes = await withCache(cacheKey, TTL.quizList, async () => {
    const filter = { isPublished: true };
    if (quizType !== "all") filter.quizType = quizType;
    return repo.getQuizzesListPipeline(filter, page, limit);
  });

  return { status: 200, body: quizzes };
};

/* ============================================================
   Get Quiz by ID or Slug
============================================================ */
export const getQuizByIdService = async (quizId) => {
  const quiz = await repo.findQuizWithCourse(quizId);
  if (!quiz) return { status: 404, body: { message: "Quiz not found" } };

  const totalQuestions = await repo.countQuestionsByQuiz(quiz._id);
  return { status: 200, body: { ...quiz, totalQuestions } };
};

/* ============================================================
   Get Quizzes For a Course
============================================================ */
export const getQuizzesForCourseService = async (courseId) => {
  const course = await findCourseBySlugOrId(courseId);
  if (!course) return { status: 404, body: { message: "Course not found" } };

  const cacheKey = `quizzes:course:${course._id}`;

  const quizzesWithCount = await withCache(cacheKey, TTL.quizList, async () => {
    const quizzes = await repo.getQuizzesForCourseDb(course._id);
    return Promise.all(
      quizzes.map(async (quiz) => {
        const totalQuestions = await repo.countQuestionsByQuiz(quiz._id);
        return { ...quiz, totalQuestions };
      }),
    );
  });

  return { status: 200, body: quizzesWithCount };
};

/* ============================================================
   Get Quiz Questions
============================================================ */
export const getQuizQuestionsService = async (quizId) => {
  const payload = await withCache(
    `quiz:${quizId}:questions`,
    TTL.singleQuiz,
    async () => {
      const quiz = await repo.findQuiz(quizId).lean();
      if (!quiz) return null;

      const questions = await repo.getQuizQuestionsDb(quiz._id);
      return {
        quizId: quiz._id,
        quizTitle: quiz.title,
        timeLimit: quiz.timeLimit,
        questions,
      };
    },
  );

  if (!payload) return { status: 404, body: { message: "Quiz not found" } };
  return { status: 200, body: payload };
};

/* ============================================================
   Get Quiz Attempt Status
============================================================ */
export const getQuizAttemptStatusService = async (quizId, user) => {
  const quiz = await repo.findQuizForStatus(quizId);
  if (!quiz) return { status: 404, body: { message: "Quiz not found" } };

  if (quiz.isPremium && !user.isSubscribed) {
    return {
      status: 403,
      body: { message: "Premium quiz. Subscription required." },
    };
  }

  const previousAttempt = await repo.findPreviousAttempt(user._id, quiz._id);

  return {
    status: 200,
    body: {
      hasAttempted: !!previousAttempt,
      allowMultipleAttempts: quiz.allowMultipleAttempts,
      lastAttempt: previousAttempt || null,
    },
  };
};

/* ============================================================
   Submit Quiz
============================================================ */
export const submitQuizService = async (
  quizId,
  { answers, timeTaken = 0 },
  user,
) => {
  if (!Array.isArray(answers) || answers.length === 0) {
    return { status: 400, body: { message: "Answers are required." } };
  }

  const quiz = await repo.findQuizForSubmit(quizId);
  if (!quiz) return { status: 404, body: { message: "Quiz not found" } };

  if (quiz.isPremium && !user.isSubscribed) {
    return {
      status: 403,
      body: { message: "Premium quiz. Subscription required." },
    };
  }

  const allQuestions = await repo.getAllQuestions(quiz._id);
  if (!allQuestions.length) {
    return { status: 400, body: { message: "No questions in this quiz." } };
  }

  // Score the submission
  let score = 0;
  const detailedResults = allQuestions.map((q) => {
    const userAnswer = answers.find(
      (a) => String(a.questionId) === String(q._id),
    );
    const isCorrect =
      userAnswer &&
      String(userAnswer.userAnswer).trim() === String(q.correctAnswer).trim();

    if (isCorrect) score += q.marks || 1;

    return {
      question: q._id,
      userAnswer: userAnswer ? userAnswer.userAnswer : null,
      correctAnswer: q.correctAnswer,
      isCorrect: !!isCorrect,
    };
  });

  const previousAttempt = await repo.findPreviousAttempt(user._id, quiz._id);

  // Single-attempt quiz retry — return score but don't save
  if (previousAttempt && !quiz.allowMultipleAttempts) {
    const percentage = Number(
      Math.min((score / allQuestions.length) * 100, 100).toFixed(2),
    );
    return {
      status: 200,
      body: {
        isRetry: true,
        score,
        totalQuestions: allQuestions.length,
        percentage,
        answers: detailedResults,
        message: "Retry attempt — score not saved",
      },
    };
  }

  const isRetryAttempt = !!previousAttempt;
  const attemptCount = await repo.countAttempts(user._id, quiz._id);

  const attempt = await repo.createAttempt({
    user: user._id,
    quiz: quiz._id,
    score,
    attemptNumber: attemptCount + 1,
    totalQuestions: allQuestions.length,
    timeTaken,
    isRetry: isRetryAttempt,
    status: "completed",
    answers: detailedResults,
  });

  const populatedAttempt = await repo.findAttemptPopulated(attempt._id);

  await cacheDelPattern(`leaderboard:quiz:${quiz._id}`);
  await cacheDel("leaderboard:global");

  return {
    status: 201,
    body: {
      message: "Quiz submitted successfully.",
      attempt: populatedAttempt,
    },
  };
};

/* ============================================================
   Get Attempt History
============================================================ */
export const getAttemptHistoryService = async (quizId, userId) => {
  const quiz = await repo.findQuizForStatus(quizId).lean();
  if (!quiz) return { status: 404, body: { message: "Quiz not found" } };

  const history = await repo.getAttemptHistoryDb(userId, quiz._id);
  return { status: 200, body: history };
};

/* ============================================================
   Review Quiz Attempt
============================================================ */
export const reviewQuizService = async (quizId, attemptNum, user) => {
  const quiz = await repo.findQuizForReview(quizId);
  if (!quiz) return { status: 404, body: { message: "Quiz not found" } };

  if (quiz.isPremium && !user.isSubscribed) {
    return {
      status: 403,
      body: { message: "Review locked. Subscribe to unlock premium quizzes." },
    };
  }

  const query = { user: user._id, quiz: quiz._id };
  let quizAttempt;

  if (attemptNum) {
    const allAttempts = await repo.getAllAttemptsForReview(query);
    quizAttempt = allAttempts[parseInt(attemptNum) - 1];
  } else {
    quizAttempt = await repo.getAttemptForReview(query);
  }

  if (!quizAttempt)
    return { status: 404, body: { message: "Attempt not found" } };

  const validAnswers = (quizAttempt.answers || []).filter(
    (ans) => ans.question !== null,
  );

  const total = validAnswers.length;
  const score = validAnswers.filter((ans) => ans.isCorrect).length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return {
    status: 200,
    body: {
      quizTitle: quiz.title,
      totalQuestions: total,
      score,
      percentage,
      answers: validAnswers.map((ans) => ({
        question: ans.question?.text,
        options: ans.question?.options,
        userAnswer: ans.userAnswer,
        correctAnswer: ans.correctAnswer,
        explanation: ans.question?.explanation,
        isCorrect: ans.isCorrect,
        marks: ans.question?.marks,
      })),
    },
  };
};

/* ============================================================
   Update Quiz
============================================================ */
export const updateQuizService = async (quizId, updates) => {
  const quiz = await repo.findQuiz(quizId);
  if (!quiz) return { status: 404, body: { message: "Quiz not found" } };

  if (updates.category === "Other" && !updates.customCategory) {
    return {
      status: 400,
      body: { message: "customCategory is required when category is Other" },
    };
  }

  if (updates.category && updates.category !== "Other") {
    updates.customCategory = null;
  }

  if (updates.slug && updates.slug !== quiz.slug) {
    const existingSlug = await repo.findQuizBySlug(updates.slug);
    if (existingSlug) {
      return {
        status: 400,
        body: { message: "This slug is already taken. Please choose another." },
      };
    }
  }

  await repo.updateQuizDb(quiz, updates);
  await invalidateQuizCache(quiz._id, quiz.slug);

  return { status: 200, body: { message: "Quiz updated", quiz } };
};

/* ============================================================
   Delete Quiz
============================================================ */
export const deleteQuizService = async (quizId) => {
  const quiz = await repo.findQuiz(quizId);
  if (!quiz) return { status: 404, body: { message: "Quiz not found" } };

  await repo.deleteQuizDb(quiz);
  await invalidateQuizCache(quiz._id, quiz.slug);

  return { status: 200, body: { message: "Quiz deleted successfully" } };
};

/* ============================================================
   Add Questions to Quiz (bulk-insert with ordered:false)
============================================================ */
export const addQuestionToQuizService = async (quizId, body) => {
  const quiz = await repo.findQuiz(quizId);
  if (!quiz) return { status: 404, body: { message: "Quiz not found" } };

  const incoming = Array.isArray(body.questions) ? body.questions : [body];

  if (incoming.length === 0) {
    return { status: 400, body: { message: "No questions provided." } };
  }
  if (incoming.length > 200) {
    return { status: 400, body: { message: "Max 200 questions per request." } };
  }

  const { valid, invalid } = partitionQuestions(incoming, quiz._id);

  if (valid.length === 0) {
    return {
      status: 400,
      body: {
        message: "All questions failed validation. Nothing was saved.",
        failed: invalid,
      },
    };
  }

  const { inserted, dbErrors } = await repo.bulkInsertQuestions(valid);

  if (inserted.length > 0) {
    const newMarks = inserted.reduce((sum, q) => sum + q.marks, 0);
    await repo.updateQuizAddQuestions(
      quiz._id,
      inserted.map((q) => q._id),
      newMarks,
      null,
    );
    await invalidateQuizCache(quiz._id, quiz.slug);
  }

  const { summary, statusCode } = buildBulkSummary(
    incoming.length,
    inserted.length,
    invalid,
    dbErrors,
  );

  return {
    status: statusCode,
    body: {
      summary,
      inserted: inserted.map((q) => ({
        _id: q._id,
        text: q.text,
        options: q.options,
        correctAnswer: q.correctAnswer,
        marks: q.marks,
      })),
      ...(invalid.length > 0 && {
        validationErrors: invalid.map(({ index, input, errors }) => ({
          index,
          text: input?.text || null,
          errors,
        })),
      }),
      ...(dbErrors.length > 0 && { dbErrors }),
    },
  };
};

/* ============================================================
   Update Question
============================================================ */
export const updateQuestionService = async (quizId, questionId, updates) => {
  const quiz = await repo.findQuiz(quizId);
  if (!quiz) return { status: 404, body: { message: "Quiz not found" } };

  const question = await repo.findQuestion(questionId, quiz._id);
  if (!question)
    return { status: 404, body: { message: "Question not found" } };

  if (updates.options && !updates.options.includes(updates.correctAnswer)) {
    return {
      status: 400,
      body: { message: "Correct answer must be one of the updated options" },
    };
  }

  await repo.updateQuestionDb(question, updates);
  await invalidateQuizCache(quiz._id, quiz.slug);

  return { status: 200, body: { message: "Question updated", question } };
};

/* ============================================================
   Delete Question
============================================================ */
export const deleteQuestionService = async (questionId) => {
  const question = await repo.findQuestionById(questionId);
  if (!question)
    return { status: 404, body: { message: "Question not found" } };

  const marksToRemove = question.marks || 0;
  await repo.updateQuizDecreaseMarks(question.quiz, marksToRemove);
  await invalidateQuizCache(question.quiz);

  return { status: 200, body: { message: "Question deleted successfully" } };
};

/* ============================================================
   Get Single Question (Admin)
============================================================ */
export const getAdminSingleQuestionService = async (questionId) => {
  const question = await repo.findQuestionByIdLean(questionId);
  if (!question)
    return { status: 404, body: { message: "Question not found" } };
  return { status: 200, body: question };
};

/* ============================================================
   Quiz Leaderboard
============================================================ */
export const getQuizLeaderboardService = async (quizId) => {
  const data = await withCache(
    `leaderboard:quiz:${quizId}`,
    TTL.leaderboard,
    async () => {
      const quiz = await repo.findQuiz(quizId);
      if (!quiz) return null;

      const leaderboard = await repo.quizLeaderboardAggregation(quiz._id);
      return { quizTitle: quiz.title, leaderboard };
    },
  );

  if (!data) return { status: 404, body: { message: "Quiz not found" } };
  return { status: 200, body: data };
};

/* ============================================================
   Global Leaderboard
============================================================ */
export const getGlobalLeaderboardService = async () => {
  const leaderboard = await withCache(
    "leaderboard:global",
    TTL.leaderboard,
    () => repo.globalLeaderboardAggregation(),
  );
  return { status: 200, body: { leaderboard } };
};

/* ============================================================
   Add Questions to Existing Quiz (transactional)
============================================================ */
export const addQuestionToExistingQuizService = async (quizId, body) => {
  const quiz = await repo.findQuiz(quizId);
  if (!quiz) return { status: 404, body: { message: "Quiz not found" } };

  const incoming = Array.isArray(body.questions) ? body.questions : [body];

  if (incoming.length === 0 || (incoming.length === 1 && !incoming[0].text)) {
    return { status: 400, body: { message: "No valid questions provided." } };
  }

  const { valid, invalid } = partitionQuestions(incoming, quiz._id);

  if (valid.length === 0) {
    return {
      status: 400,
      body: { message: "All questions failed validation.", failed: invalid },
    };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const insertedDocs = await repo.insertManyQuestions(valid, session);
    const insertedIds = insertedDocs.map((q) => q._id);
    const newMarks = insertedDocs.reduce((sum, q) => sum + q.marks, 0);

    await repo.updateQuizAddQuestions(quiz._id, insertedIds, newMarks, session);

    await session.commitTransaction();
    session.endSession();

    await invalidateQuizCache(quiz._id, quiz.slug);

    return {
      status: 201,
      body: {
        status: "success",
        summary: {
          requested: incoming.length,
          added: insertedDocs.length,
          failed: invalid.length,
        },
        newTotalMarks: quiz.totalMarks + newMarks,
        invalidQuestions: invalid.length > 0 ? invalid : undefined,
      },
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};
