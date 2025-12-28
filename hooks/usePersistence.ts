
import React, { useEffect, useRef, useCallback } from 'react';
import { 
  StoryProject, ProjectAction, UIAction, ViewMode 
} from '../types';
import { loadProject, saveProject, getPortrait } from '../services/storageService';
import { normalizeProject } from '../services/bibleManager';

export const usePersistence = (
  project: StoryProject, 
  projectDispatch: React.Dispatch<ProjectAction>,
  uiDispatch: React.Dispatch<UIAction>
) => {
  const isInitialLoad = useRef(true);
  const isSaving = useRef(false);
  const pendingSaveRef = useRef<StoryProject | null>(null);

  const performSave = useCallback(async (proj: StoryProject) => {
    if (isSaving.current) {
      pendingSaveRef.current = proj;
      return;
    }
    
    isSaving.current = true;
    uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });
    
    try {
      const strippedProject = { 
        id: proj.meta.id,
        meta: proj.meta,
        bible: { 
          ...proj.bible, 
          characters: proj.bible.characters.map(({ imageUrl, ...rest }: any) => rest) 
        },
        chapters: proj.chapters.map(({ content, ...rest }) => rest),
        sync: proj.sync
      };
      
      await saveProject(strippedProject);
      localStorage.setItem('duoscript_active_id', proj.meta.id);
      uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });
      setTimeout(() => uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'idle' }), 2000);
    } catch (err) {
      console.error("Save failed", err);
      uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'idle' });
    } finally {
      isSaving.current = false;
      if (pendingSaveRef.current) {
        const next = pendingSaveRef.current;
        pendingSaveRef.current = null;
        performSave(next);
      }
    }
  }, [uiDispatch]);

  // Initial Data Restoration
  useEffect(() => {
    const initLoad = async () => {
      const lastProjectId = localStorage.getItem('duoscript_active_id');
      if (lastProjectId) {
        try {
          const storedProjectData = await loadProject(lastProjectId);
          if (storedProjectData) {
            const norm = normalizeProject(storedProjectData);
            
            // ポートレート画像の復元
            const results = await Promise.all(norm.bible.characters.map(async (char) => {
              const img = await getPortrait(char.id);
              return img ? { id: char.id, img } : null;
            }));
            const found = results.filter((r): r is {id: string, img: string} => r !== null);
            if (found.length > 0) {
              norm.bible.characters = norm.bible.characters.map(c => {
                const match = found.find(f => f.id === c.id);
                return match ? { ...c, imageUrl: match.img } : c;
              });
            }
            
            projectDispatch({ type: 'LOAD_PROJECT', payload: norm });
            uiDispatch({ type: 'SET_VIEW', payload: ViewMode.DASHBOARD });
          }
        } catch (e) {
          console.error("Initial load from storage failed", e);
        } finally {
          isInitialLoad.current = false;
        }
      } else {
        isInitialLoad.current = false;
      }
    };
    initLoad();
  }, [projectDispatch, uiDispatch]);

  // Auto-save Watcher
  useEffect(() => {
    if (isInitialLoad.current || !project.meta.id) return;
    
    const timer = setTimeout(() => {
      performSave(project);
    }, 3000);

    return () => clearTimeout(timer);
  }, [project, performSave]);
};
