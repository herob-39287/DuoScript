
import { AppLanguage } from "../../../types";
import { getPrompts } from "./resources";

export const LIBRARIAN_SOUL = (lang: AppLanguage) => {
  const p = getPrompts(lang);
  return p.librarian.soul;
};
