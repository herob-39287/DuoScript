import { produce } from 'immer';
import { ChapterLog, ChapterAction, BibleAction } from '../../types';

export const chaptersReducer = (
  state: ChapterLog[],
  action: ChapterAction | BibleAction,
): ChapterLog[] => {
  return produce(state, (draft) => {
    switch (action.type) {
      case 'LOAD_CHAPTERS':
        return action.payload;
      case 'UPDATE_CHAPTER': {
        const chapter = draft.find((c) => c.id === action.id);
        if (chapter) {
          Object.assign(chapter, action.updates);
          if (action.updates.content !== undefined) {
            chapter.wordCount = action.updates.content.length;
          }
          chapter.updatedAt = Date.now();
        }
        break;
      }
      case 'SET_CHAPTER_CONTENT': {
        const chapter = draft.find((c) => c.id === action.id);
        if (chapter) {
          chapter.content = action.content;
          chapter.wordCount = action.content.length;
          chapter.updatedAt = Date.now();
        }
        break;
      }
      case 'ADD_CHAPTER':
        draft.push(action.payload);
        break;
      case 'REMOVE_CHAPTER': {
        const idx = draft.findIndex((c) => c.id === action.id);
        if (idx !== -1) draft.splice(idx, 1);
        break;
      }
      case 'APPLY_SYNC_OP':
      case 'UNDO_BIBLE':
        if (action.payload.nextChapters) {
          return action.payload.nextChapters;
        }
        break;
    }
  });
};
