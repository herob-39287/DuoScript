
import React, { useCallback } from 'react';
import { 
  StoryProject, ProjectAction
} from '../types';

/**
 * プロジェクトの初期化およびロードロジックをカプセル化するカスタムフック。
 */
export const useProjectLoader = (dispatch: React.Dispatch<ProjectAction>) => {
  const loadFullProject = useCallback((project: StoryProject) => {
    dispatch({ type: 'LOAD_PROJECT', payload: project });
  }, [dispatch]);

  return { loadFullProject };
};
