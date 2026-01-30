import { useState } from 'react';
import { useUIDispatch } from '../contexts/StoryContext';
import * as Actions from '../store/actions';
import { ViewMode } from '../types';

export const useWriterUI = () => {
  const uiDispatch = useUIDispatch();

  const [isZenMode, setIsZenMode] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'plot' | 'bible'>('plot');
  const [mobileTab, setMobileTab] = useState<'none' | 'chapters' | 'rightPanel'>('none');

  const toggleVertical = () => setIsVertical(!isVertical);
  const toggleZen = () => setIsZenMode(!isZenMode);
  const toggleSettings = (show: boolean) => setShowSettings(show);
  const navigateBack = () => uiDispatch(Actions.setView(ViewMode.DASHBOARD));

  return {
    isZenMode,
    isVertical,
    showSettings,
    rightPanelTab,
    mobileTab,
    toggleVertical,
    toggleZen,
    toggleSettings,
    setRightPanelTab,
    setMobileTab,
    navigateBack,
  };
};
