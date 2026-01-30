import React, { createContext, useContext } from 'react';
import { UIState, UIAction } from '../../types';

export const UIStateContext = createContext<UIState | undefined>(undefined);
export const UIDispatchContext = createContext<React.Dispatch<UIAction> | undefined>(undefined);

export type UIDispatch = React.Dispatch<UIAction>;

export const useUI = () => {
  const context = useContext(UIStateContext);
  if (!context) throw new Error('useUI must be used within a UIStateContext.Provider');
  return context;
};

export const useUIDispatch = () => {
  const context = useContext(UIDispatchContext);
  if (!context) throw new Error('useUIDispatch must be used within a UIDispatchContext.Provider');
  return context;
};
