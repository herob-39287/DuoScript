import { produce } from 'immer';
import { ChapterLog, ChapterAction, BibleAction } from '../../types';
import { syncChapterCompiledContentFromScenePackages } from '../../services/scenePackage';

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
          if (action.updates.scenePackages !== undefined) {
            const synced = syncChapterCompiledContentFromScenePackages(chapter as ChapterLog);
            chapter.compiledContent = synced.compiledContent;
            chapter.wordCount = synced.wordCount;
          } else if (
            action.updates.draftText !== undefined &&
            chapter.authoringMode !== 'structured'
          ) {
            chapter.wordCount = action.updates.draftText.length;
          }
          chapter.updatedAt = Date.now();
        }
        break;
      }
      case 'SET_CHAPTER_DRAFT_TEXT': {
        const chapter = draft.find((c) => c.id === action.id);
        if (chapter && chapter.authoringMode !== 'structured') {
          chapter.draftText = action.draftText;
          chapter.wordCount = action.draftText.length;
          chapter.updatedAt = Date.now();
        }
        break;
      }
      case 'SET_CHAPTER_AUTHORING_MODE': {
        const chapter = draft.find((c) => c.id === action.id);
        if (chapter) {
          chapter.authoringMode = action.mode;
          if (action.mode === 'freeform') {
            chapter.draftText = chapter.draftText ?? chapter.compiledContent ?? chapter.content ?? '';
            chapter.wordCount = chapter.draftText.length;
          } else {
            const synced = syncChapterCompiledContentFromScenePackages(chapter as ChapterLog);
            chapter.compiledContent = synced.compiledContent;
            chapter.wordCount = synced.wordCount;
          }
          chapter.updatedAt = Date.now();
        }
        break;
      }
      case 'ADD_CHAPTER':
        draft.push(syncChapterCompiledContentFromScenePackages(action.payload));
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
