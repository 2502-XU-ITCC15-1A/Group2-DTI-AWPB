export const isSubmissionWindowOpen = (window) => {
  const { startDate, endDate } = window || {};

  if (!startDate || !endDate) return false;

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  return now >= start && now <= end;
};