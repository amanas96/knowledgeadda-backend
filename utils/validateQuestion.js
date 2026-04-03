// utils/validateQuestion.js
export function validateQuestion(q, index) {
  const errors = [];
  if (!q?.text?.trim()) errors.push("text is required");
  if (!Array.isArray(q.options) || q.options.length < 2)
    errors.push("options must have at least 2 items");
  else if (q.options.length > 6)
    errors.push("options must have at most 6 items");
  else {
    const trimmed = q.options.map((o) => String(o).trim());
    if (trimmed.some((o) => !o))
      errors.push("options must not contain empty strings");
    else if (new Set(trimmed).size !== trimmed.length)
      errors.push("options must be unique");
  }
  if (!q.correctAnswer) errors.push("correctAnswer is required");
  else if (
    Array.isArray(q.options) &&
    !q.options.map((o) => String(o).trim()).includes(q.correctAnswer)
  )
    errors.push("correctAnswer must be one of the provided options");
  if (q.marks !== undefined && q.marks !== null) {
    const m = Number(q.marks);
    if (isNaN(m) || m <= 0) errors.push("marks must be a positive number");
  }
  return errors;
}
