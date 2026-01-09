
import React, { useReducer, useState, useCallback, useMemo } from 'react';
import ComplianceModal from './components/ComplianceModal';
import { AppProviders } from './components/AppProviders';
import AppShell from './components/AppShell';
import { 
  ViewMode, StoryProject, SystemLog, UIState, AppPreferences
} from './types';
import { normalizeProject } from './services/bibleManager';
import { projectReducer, uiReducer, notificationReducer } from './store/reducers';
import { usePersistence } from './hooks/usePersistence';
import { useProjectLoader } from './hooks/useProjectLoader';
import * as Actions from './store/actions';

const App: React.FC = () => {
  const emptyProject = normalizeProject(null);
  
  const [project, projectDispatch] = useReducer(projectReducer, emptyProject);
  
  const initialUIState: UIState = {
    view: ViewMode.WELCOME,
    plotterTab: 'grandArc',
    pendingMsg: null,
    dialog: { isOpen: false, type: 'alert', title: '', message: '' },
    safetyIntervention: { isOpen: false, alternatives: [], isLocked: false },
    showPubModal: false,
    showHelpModal: false,
    saveStatus: 'idle',
    isConflict: false,
    forceSaveRequested: false, // Initialize forceSave flag
    isContextActive: true, // Story context activation flag
    thinkingPhase: null // AIの思考プロセスを表示するための状態
  };
  const [ui, uiDispatch] = useReducer(uiReducer, initialUIState);
  
  const [notifState, notifDispatch] = useReducer(notificationReducer, { logs: [], notifications: [] });
  
  const { loadFullProject } = useProjectLoader(projectDispatch);

  const [hasAgreed, setHasAgreed] = useState(localStorage.getItem('duoscript_agreed_v2') === 'true');

  usePersistence(project, ui, projectDispatch, uiDispatch);

  const addLog = useCallback((type: SystemLog['type'], source: SystemLog['source'], message: string, details?: string) => {
    notifDispatch({ type: 'ADD_LOG', payload: { id: crypto.randomUUID(), timestamp: Date.now(), type, source, message, details } });
  }, []);

  const handleCompleteSetup = (prefs: AppPreferences) => {
    localStorage.setItem('duoscript_agreed_v2', 'true');
    localStorage.setItem('duoscript_prefs', JSON.stringify(prefs));
    projectDispatch(Actions.updatePreferences(prefs));
    setHasAgreed(true);
  };

  const notificationDispatch = useMemo(() => ({ addLog, dispatch: notifDispatch }), [addLog]);

  if (!hasAgreed) {
    return (
      <ComplianceModal onAccept={handleCompleteSetup} />
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
