import { StoryProject, ProjectAction, MetaAction, BibleAction, SyncAction } from '../types';
import { metaReducer } from './reducers/meta';
import { bibleReducer } from './reducers/bible';
import { chaptersReducer } from './reducers/chapters';
import { syncReducer } from './reducers/sync';

export * from './reducers/meta';
export * from './reducers/bible';
export * from './reducers/chapters';
export * from './reducers/sync';
export * from './reducers/ui';
export * from './reducers/notification';

export const projectReducer = (state: StoryProject, action: ProjectAction): StoryProject => {
  if (action.type === 'LOAD_PROJECT') {
    return action.payload;
  }

  return {
    meta: metaReducer(state.meta, action as MetaAction),
    bible: bibleReducer(state.bible, action as BibleAction),
    chapters: chaptersReducer(state.chapters, action as any),
    sync: syncReducer(state.sync, action as SyncAction),
  };
};
