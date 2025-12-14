import { createContext } from 'react';
import type { Theme } from 'react-toastify';

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

export const ThemeContext = createContext<ThemeProviderState>(initialState);
