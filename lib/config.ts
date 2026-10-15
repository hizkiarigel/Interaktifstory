export const MAIN_CHARACTERS = (process.env.MAIN_CHARACTERS || "Ethan")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const IMAGE_LONG_SIDE = 1800;
export const IMAGE_SMALL_SIDE = 900;
export const SESSION_DAYS = 7;
