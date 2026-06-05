import React, { createContext, useContext, useEffect, useReducer } from 'react';
import type { AppSettings, Difficulty, TrainingResult } from './types';
import { loadSettings, saveSettings, loadResults, saveResult } from './storage';

// ===== State =====

interface AppState {
  settings: AppSettings;
  results: TrainingResult[];
  isLoaded: boolean;
}

const initialState: AppState = {
  settings: {
    voiceEnabled: true,
    darkMode: false,
    onboardingDone: false,
  },
  results: [],
  isLoaded: false,
};

// ===== Actions =====

type Action =
  | { type: 'LOAD_DONE'; settings: AppSettings; results: TrainingResult[] }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<AppSettings> }
  | { type: 'ADD_RESULT'; result: TrainingResult };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_DONE':
      return { ...state, settings: action.settings, results: action.results, isLoaded: true };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case 'ADD_RESULT':
      return { ...state, results: [action.result, ...state.results].slice(0, 200) };
    default:
      return state;
  }
}

// ===== Context =====

interface AppContextValue {
  state: AppState;
  updateSettings: (s: Partial<AppSettings>) => void;
  addResult: (r: TrainingResult) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      const [settings, results] = await Promise.all([loadSettings(), loadResults()]);
      dispatch({ type: 'LOAD_DONE', settings, results });
    })();
  }, []);

  const updateSettings = (s: Partial<AppSettings>) => {
    const next = { ...state.settings, ...s };
    dispatch({ type: 'UPDATE_SETTINGS', settings: s });
    saveSettings(next);
  };

  const addResult = (r: TrainingResult) => {
    dispatch({ type: 'ADD_RESULT', result: r });
    saveResult(r);
  };

  return (
    <AppContext.Provider value={{ state, updateSettings, addResult }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
