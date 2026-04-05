import asyncHandler from "express-async-handler";
import WatchHistory from "../models/watchHistoryModel.js";
import ApiResponse from "../../utils/ApiResponse.js";

// ===============================
// @desc    Update watch progress for a content item
// @route   POST /api/v1/watch-progress
// @access  Private
// ===============================
export const updateWatchProgress = asyncHandler(async (req, res) => {
  const { contentId, courseId, watchedMinutes } = req.body;

  const entry = await WatchHistory.findOneAndUpdate(
    { user: req.user._id, content: contentId },
    {
      $set: {
        course: courseId,
        lastWatchedAt: new Date(),
      },
      $max: { watchedMinutes }, // only update if new value is higher
    },
    { upsert: true, new: true },
  );

  new ApiResponse(200, entry, "Watch progress updated successfully").send(res);
});
