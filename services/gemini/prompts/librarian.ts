import { AppLanguage } from '../../../types';
import { getTemplate } from './resources';

export const LIBRARIAN_SOUL = (lang: AppLanguage) => {
  return getTemplate('librarian.soul', lang);
};
