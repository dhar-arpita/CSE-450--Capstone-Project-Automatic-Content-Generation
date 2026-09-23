// shared/utils/classTier.js
//
// Which curriculum tier a class belongs to. The backend's Class table has an
// educational_level column (see backend/models/db_models.py and
// GET /curriculum/classes), but there's no guarantee every row has it filled
// in yet. Class names follow "Class <n>" consistently across the app (see
// every SelectField built from getClasses()), so deriving the tier from the
// number is the one thing that works today regardless of that data's state.
//
// Bangladesh's National Curriculum split: Primary 1-5, Junior 6-8, Secondary
// 9-10.
export function getClassTier(className) {
  if (!className) return null;
  const match = String(className).match(/(\d+)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (n >= 1 && n <= 5) return "primary";
  if (n >= 6 && n <= 8) return "junior";
  if (n >= 9 && n <= 10) return "secondary";
  return null;
}

export function isPrimaryClass(className) {
  return getClassTier(className) === "primary";
}
