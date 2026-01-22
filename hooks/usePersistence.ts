
import React, { useEffect, useRef, useCallback } from 'react';
import { 
  StoryProject, ProjectAction, UIAction, ViewMode, UIState 
} from '../types';
import { loadLatestProject, saveProjectRevision, getLastOpenedProjectId, loadFullSnapshot, tabId, getHeadRev, getSyncChannel } from '../services/storageService';
import { normalizeProject } from '../services/bibleManager';

/**
 * Checks if there are meaningful changes between two project states.
 * Uses reference equality for large objects (Immer guarantees refs change only on update)
 * and shallow/limited comparison for Metadata.
 */
const hasMeaningfulChanges = (prev: StoryProject | null, next: StoryProject): boolean => {
  if (!prev) return true;
  if (prev === next) return false;

  // 1. Heavy Objects Reference Check (Fastest)
  // If these references are different, the content MUST have changed due to Immer.
  if (prev.bible !== next.bible) return true;
  if (prev.chapters !== next.chapters) return true;
  if (prev.sync !== next.sync) return true;
  // Assets removed from state

  // 2. Metadata Check (Slower but small data size)
  // We exclude volatile fields that shouldn't trigger a save on their own
  if (prev.meta !== next.meta) {
    const { tokenUsage: t1, updatedAt: u1, headRev: h1, ...meta1 } = prev.meta;
    const { tokenUsage: t2, updatedAt: u2, headRev: h2, ...meta2 } = next.meta;
    
    // JSON.stringify on meta is cheap (~1KB) compared to full project (~MBs)
    if (JSON.stringify(meta1) !== JSON.stringify(meta2)) return true;
  }

  return false;
};

export const usePersistence = (
  project: StoryProject,
  ui: UIState,
  projectDispatch: React.Dispatch<ProjectAction>,
  uiDispatch: React.Dispatch<UIAction>
) => {
  const isInitialLoad = useRef(true);
  const isSaving = useRef(false);
  const pendingSaveRef = useRef<StoryProject | null>(null);
  const hasConflict = useRef(false);
  
  // Track active project ID to detect switches
  const activeProjectIdRef = useRef<string | null>(null);
  
  // Track the authoritative headRev for this tab instance to avoid queue-induced conflicts
  const currentHeadRevRef = useRef<number>(project.meta.headRev || 0);
  
  // Safety sync: Ensure ref catches up if state is ahead (e.g. after load)
  if ((project.meta.headRev || 0) > currentHeadRevRef.current) {
    currentHeadRevRef.current = project.meta.headRev || 0;
  }
  
  // Store the last successfully saved project object for reference comparison
  const lastSavedStateRef = useRef<StoryProject | null>(null);

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
      
      const updatedMeta = { ...proj.meta, headRev: nextRev };
      projectDispatch({ type: 'UPDATE_META', payload: { headRev: nextRev } });
      localStorage.setItem('duoscript_active_id', proj.meta.id);
      
      // Update stable ref with the state that was just saved (including new rev)
      lastSavedStateRef.current = { ...proj, meta: updatedMeta };
      
      uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });
      setTimeout(() => uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'idle' }), 2000);
    } catch (err: any) {
      if (err.message === 'SAVE_CONFLICT') {
        hasConflict.current = true;
        
        // Auto-resolve if we are saving from Rev 0 (likely Import or Overwrite of existing ID)
        if (currentHeadRevRef.current === 0) {
           console.warn("Auto-resolving conflict for initial save (Import/Overwrite).");
           uiDispatch({ type: 'SET_FORCE_SAVE_REQUESTED', payload: true });
        } else {
           uiDispatch({ type: 'SET_CONFLICT', payload: true });
           console.error("Conflict: IDB Head has moved while this tab was editing.");
        }
      } else if (err.message === 'STORAGE_QUOTA_EXCEEDED') {
        console.error("Storage Quota Exceeded");
        uiDispatch({ 
          type: 'OPEN_DIALOG', 
          payload: { 
            isOpen: true, 
            type: 'alert', 
            title: '保存容量不足', 
            message: 'ブラウザの保存容量がいっぱいです。これ以上保存できません。古いプロジェクトや画像を削除して容量を確保してください。' 
          } 
        });
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

  // Handle Force Save Request (Rebase Strategy)
  useEffect(() => {
    if (ui.forceSaveRequested && hasConflict.current) {
      const handleForceSave = async () => {
        isSaving.current = true; // Block other saves
        uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'saving' });
        try {
          // 1. Fetch latest head revision from DB (Truth source)
          const latestRev = await getHeadRev(project.meta.id);
          
          // 2. Perform Save
          // We pass latestRev as 'expectedRev' to saveProjectRevision.
          // This creates a new revision on top of the remote head, effectively forcing our local state
          // to become the newest version, overwriting any concurrent changes logic-wise (but preserving history).
          const nextRev = await saveProjectRevision(project, latestRev);
          
          // 3. Update local state
          currentHeadRevRef.current = nextRev;
          projectDispatch({ type: 'UPDATE_META', payload: { headRev: nextRev } });
          
          // 4. Update stable ref to prevent immediate auto-save trigger
          const rebasedProject = { ...project, meta: { ...project.meta, headRev: nextRev } };
          lastSavedStateRef.current = rebasedProject;

          // 5. Reset Conflict Flags
          hasConflict.current = false;
          uiDispatch({ type: 'SET_CONFLICT', payload: false });
          uiDispatch({ type: 'SET_FORCE_SAVE_REQUESTED', payload: false });
          uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'saved' });
          setTimeout(() => uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'idle' }), 2000);

        } catch (e: any) {
          console.error("Force save failed", e);
          uiDispatch({ type: 'SET_SAVE_STATUS', payload: 'idle' });
          uiDispatch({ type: 'SET_FORCE_SAVE_REQUESTED', payload: false });
          if (e.message === 'STORAGE_QUOTA_EXCEEDED') {
             uiDispatch({ 
                type: 'OPEN_DIALOG', 
                payload: { 
                  isOpen: true, 
                  type: 'alert', 
                  title: '保存容量不足', 
                  message: '強制保存に失敗しました。容量が不足しています。' 
                } 
             });
          }
          // Conflict remains active
        } finally {
          isSaving.current = false;
        }
      };
      handleForceSave();
    }
  }, [ui.forceSaveRequested, project, projectDispatch, uiDispatch]);

  // プロジェクトのコンテキスト切り替え検知
  useEffect(() => {
    const isNewId = project.meta.id && project.meta.id !== activeProjectIdRef.current;
    
    // プロジェクトIDが変更された場合、または外部要因（Sync/Undo）でHeadが進んだ場合にRefを同期
    if (isNewId || (project.meta.headRev || 0) > currentHeadRevRef.current) {
      if (isNewId) {
        activeProjectIdRef.current = project.meta.id;
        // ID切り替え時はコンフリクト状態をリセット
        hasConflict.current = false;
        uiDispatch({ type: 'SET_CONFLICT', payload: false });
      }
      
      currentHeadRevRef.current = project.meta.headRev || 0;
      lastSavedStateRef.current = project;
    }
  }, [project.meta.id, project.meta.headRev, uiDispatch, project]);

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
            
            // Optimization: Skip asset hydration. 
            // Characters store the portrait ID, components will lazy load via usePortrait hook.
            
            // ステート更新
            projectDispatch({ type: 'LOAD_PROJECT', payload: norm });
            // Ref will be updated by the context-switch useEffect
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
          const isDirty = hasMeaningfulChanges(lastSavedStateRef.current, project);
          
          if (isDirty) {
            hasConflict.current = true;
            uiDispatch({ type: 'SET_CONFLICT', payload: true });
          } else {
            // Cleanならサイレント同期
            const updatedProject = await loadFullSnapshot(projectId, rev);
            if (updatedProject) {
              const norm = normalizeProject(updatedProject);
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
      // High-performance dirty check using reference equality
      if (hasMeaningfulChanges(lastSavedStateRef.current, project)) {
        performSave(project);
      }
    }, 5000); 

    return () => clearTimeout(timer);
  }, [project, performSave]);

  // Prevent accidental close if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasMeaningfulChanges(lastSavedStateRef.current, project) || isSaving.current) {
        e.preventDefault(); 
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [project]);
};