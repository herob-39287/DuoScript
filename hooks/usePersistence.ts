
import React, { useEffect, useRef, useCallback } from 'react';
import { 
  StoryProject, ProjectAction, UIAction, ViewMode 
} from '../types';
import { loadLatestProject, saveProjectRevision, getPortrait, getLastOpenedProjectId, getSyncChannel, loadFullSnapshot, tabId } from '../services/storageService';
import { normalizeProject } from '../services/bibleManager';

export const usePersistence = (
  project: StoryProject, 
  projectDispatch: React.Dispatch<ProjectAction>,
  uiDispatch: React.Dispatch<UIAction>
) => {
  const isInitialLoad = useRef(true);
  const isSaving = useRef(false);
  const pendingSaveRef = useRef<StoryProject | null>(null);
  const hasConflict = useRef(false);
  
  // Track the authoritative headRev for this tab instance to avoid queue-induced conflicts
  const currentHeadRevRef = useRef<number>(project.meta.headRev || 0);
  
  // 保存に成功した直近のステート（Transient属性を除外して比較用）
  const lastKnownStableStateRef = useRef<string>("");

  const getComparableState = (proj: StoryProject) => {
    // metadataのupdatedAtやtokenUsageなどは変更頻度が高く競合の本質ではないため除外
    const { tokenUsage, updatedAt, headRev, ...meta } = proj.meta;
    return JSON.stringify({ ...proj, meta });
  };

  const performSave = useCallback(async (proj: StoryProject) => {
    if (hasConflict.current) return;
    if (isSaving.current) {
      pendingSaveRef.current = proj;
      return;
    }
    
    isSaving.current = true;
    uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });
    
    try {
      // Use the ref value instead of the potentially stale state value
      const expectedRev = currentHeadRevRef.current;
      const nextRev = await saveProjectRevision(proj, expectedRev);
      
      // Update our authoritative headRev ref
      currentHeadRevRef.current = nextRev;
      
      projectDispatch({ type: 'UPDATE_META', payload: { headRev: nextRev } });
      localStorage.setItem('duoscript_active_id', proj.meta.id);
      
      // 保存成功時のスナップショットを記録
      lastKnownStableStateRef.current = getComparableState({ ...proj, meta: { ...proj.meta, headRev: nextRev } });
      
      uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });
      setTimeout(() => uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'idle' }), 2000);
    } catch (err: any) {
      if (err.message === 'SAVE_CONFLICT') {
        hasConflict.current = true;
        uiDispatch({ type: 'SET_CONFLICT', payload: true });
        console.error("Conflict: IDB Head has moved while this tab was editing.");
      } else {
        console.error("Save failed:", err);
      }
      uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'idle' });
    } finally {
      isSaving.current = false;
      if (pendingSaveRef.current && !hasConflict.current) {
        const next = { ...pendingSaveRef.current };
        pendingSaveRef.current = null;
        performSave(next);
      }
    }
  }, [uiDispatch, projectDispatch]);

  // 初期ロード
  useEffect(() => {
    const initLoad = async () => {
      let lastProjectId = localStorage.getItem('duoscript_active_id');
      if (!lastProjectId) {
        lastProjectId = await getLastOpenedProjectId();
      }

      if (lastProjectId) {
        try {
          const storedData = await loadLatestProject(lastProjectId);
          if (storedData) {
            const norm = normalizeProject(storedData);
            
            // 肖像画の復元（軽量化のためIDB参照）
            const portraitResults = await Promise.all(norm.bible.characters.map(async (char) => {
              const img = await getPortrait(char.id);
              return img ? { id: char.id, img } : null;
            }));
            const foundPortraits = portraitResults.filter((r): r is {id: string, img: string} => r !== null);
            if (foundPortraits.length > 0) {
              norm.bible.characters = norm.bible.characters.map(c => {
                const match = foundPortraits.find(f => f.id === c.id);
                return match ? { ...c, imageUrl: match.img } : c;
              });
            }
            
            currentHeadRevRef.current = norm.meta.headRev || 0;
            lastKnownStableStateRef.current = getComparableState(norm);
            projectDispatch({ type: 'LOAD_PROJECT', payload: norm });
            uiDispatch({ type: 'SET_VIEW', payload: ViewMode.DASHBOARD });
          }
        } catch (e) {
          console.error("Restore failed", e);
        } finally {
          isInitialLoad.current = false;
        }
      } else {
        isInitialLoad.current = false;
      }
    };
    initLoad();
  }, [projectDispatch, uiDispatch]);

  // マルチタブ同期（他タブでの保存検知）
  useEffect(() => {
    const channel = getSyncChannel();
    const onMessage = async (event: MessageEvent) => {
      const { type, projectId, rev, sender } = event.data;
      
      // Filter out messages from the current tab instance
      if (sender === tabId) return;

      if (type === 'REVISION_SAVED' && projectId === project.meta.id) {
        if (currentHeadRevRef.current < rev) {
          // 自タブがDirty（未保存の変更がある）か判定
          const isDirty = lastKnownStableStateRef.current !== getComparableState(project);
          
          if (isDirty) {
            hasConflict.current = true;
            uiDispatch({ type: 'SET_CONFLICT', payload: true });
          } else {
            // Cleanならサイレント同期
            const updatedProject = await loadFullSnapshot(projectId, rev);
            if (updatedProject) {
              const norm = normalizeProject(updatedProject);
              currentHeadRevRef.current = norm.meta.headRev || 0;
              lastKnownStableStateRef.current = getComparableState(norm);
              projectDispatch({ type: 'LOAD_PROJECT', payload: norm });
            }
          }
        }
      }
    };
    channel.addEventListener('message', onMessage);
    return () => channel.removeEventListener('message', onMessage);
  }, [project, projectDispatch, uiDispatch]);

  // 自動保存サイクル
  useEffect(() => {
    if (isInitialLoad.current || !project.meta.id || hasConflict.current) return;
    
    const timer = setTimeout(() => {
      const isDirty = lastKnownStableStateRef.current !== getComparableState(project);
      if (isDirty) {
        performSave(project);
      }
    }, 10000); 

    return () => clearTimeout(timer);
  }, [project, performSave]);
};
