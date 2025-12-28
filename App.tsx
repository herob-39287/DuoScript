
import React, { useReducer, useState, useCallback, useMemo } from 'react';
import ComplianceModal from './components/ComplianceModal';
import { AppProviders } from './components/AppProviders';
import AppShell from './components/AppShell';
import { 
  ViewMode, StoryProject, SystemLog, UIState
} from './types';
import { normalizeProject } from './services/bibleManager';
import { projectReducer, uiReducer, notificationReducer } from './store/reducers';
import { usePersistence } from './hooks/usePersistence';
import { useProjectLoader } from './hooks/useProjectLoader';

const App: React.FC = () => {
  const emptyProject = normalizeProject(null);
  
  // Integrated Project State
  const [project, projectDispatch] = useReducer(projectReducer, emptyProject);
  
  // UI State
  const initialUIState: UIState = {
    view: ViewMode.WELCOME,
    plotterTab: 'grandArc',
    pendingMsg: null,
    dialog: { isOpen: false, type: 'alert', title: '', message: '' },
    showPubModal: false,
    showHelpModal: false,
    saveStatus: 'idle'
  };
  const [ui, uiDispatch] = useReducer(uiReducer, initialUIState);
  
  // Notification State
  const [notifState, notifDispatch] = useReducer(notificationReducer, { logs: [], notifications: [] });
  
  // Project Loader Hook
  const { loadFullProject } = useProjectLoader(projectDispatch);

  // Non-reducer transient state
  const [hasAgreed, setHasAgreed] = useState(localStorage.getItem('duoscript_agreed') === 'true');

  // Persistence Hook
  usePersistence(project, projectDispatch, uiDispatch);

  const addLog = useCallback((type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => {
    notifDispatch({ type: 'ADD_LOG', payload: { id: crypto.randomUUID(), timestamp: Date.now(), type, source, message, details } });
  }, []);

  const notificationDispatch = useMemo(() => ({ addLog, dispatch: notifDispatch }), [addLog]);

  if (!hasAgreed) {
    return (
      <ComplianceModal onAccept={() => { 
        localStorage.setItem('duoscript_agreed', 'true'); 
        setHasAgreed(true); 
      }} />
    );
  }

  return (
    <AppProviders 
      state={{ ...project, ui, notification: notifState }}
      dispatchers={{ project: projectDispatch, ui: uiDispatch, notification: notificationDispatch }}
    >
      <AppShell onLoadProject={loadFullProject} />
    </AppProviders>
  );
};

export default App;
