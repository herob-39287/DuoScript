
import React, { useEffect, useRef, useState } from 'react';
import { 
  StoryProject, ViewMode, MetaAction, BibleAction, ChapterAction, SyncAction 
} from '../types';
import { loadProject, saveProject, getPortrait } from '../services/storageService';
import { normalizeProject } from '../services/bibleManager';

interface Dispatchers {
  metaDispatch: React.Dispatch<MetaAction>;
  bibleDispatch: React.Dispatch<BibleAction>;
  chaptersDispatch: React.Dispatch<ChapterAction>;
  syncDispatch: React.Dispatch<SyncAction>;
}

export const usePersistence = (
  project: StoryProject, 
  dispatchers: Dispatchers,
  setView: (v: ViewMode) => void
) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<number | null>(null);
  const isInitialLoad = useRef(true);

  const { metaDispatch, bibleDispatch, chaptersDispatch, syncDispatch } = dispatchers;

  useEffect(() => {
    const initLoad = async () => {
      const lastProjectId = localStorage.getItem('duoscript_active_id');
      if (lastProjectId) {
        try {
          const storedProjectData = await loadProject(lastProjectId);
          if (storedProjectData) {
            const norm = normalizeProject(storedProjectData);
            metaDispatch({ type: 'LOAD_META', payload: norm.meta });
            bibleDispatch({ type: 'LOAD_BIBLE', payload: norm.bible });
            chaptersDispatch({ type: 'LOAD_CHAPTERS', payload: norm.chapters.map(({ content, ...rest }) => rest as any) });
            syncDispatch({ type: 'LOAD_SYNC', payload: norm.sync });
            
            const results = await Promise.all(norm.bible.characters.map(async (char) => {
              const img = await getPortrait(char.id);
              return img ? { id: char.id, img } : null;
            }));
            const found = results.filter((r): r is {id: string, img: string} => r !== null);
            if (found.length > 0) {
              bibleDispatch({ 
                type: 'UPDATE_BIBLE', 
                payload: { 
                  characters: norm.bible.characters.map(c => {
                    const match = found.find(f => f.id === c.id);
                    return match ? { ...c, imageUrl: match.img } : c;
                  }) 
                } 
              });
            }
            setView(ViewMode.DASHBOARD);
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
  }, [metaDispatch, bibleDispatch, chaptersDispatch, syncDispatch, setView]);

  useEffect(() => {
    if (isInitialLoad.current || !project.meta.id) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const strippedProject = { 
          id: project.meta.id,
          meta: project.meta,
          bible: { 
            ...project.bible, 
            characters: project.bible.characters.map(({ imageUrl, ...rest }: any) => rest) 
          },
          chapters: project.chapters.map(({ content, ...rest }) => rest),
          sync: project.sync
        };
        await saveProject(strippedProject);
        localStorage.setItem('duoscript_active_id', project.meta.id);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error("Auto-save failed", err);
        setSaveStatus('idle');
      }
    }, 3000); 
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [project.meta, project.bible, project.chapters, project.sync]);

  return { saveStatus };
};
