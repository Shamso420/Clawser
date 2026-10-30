'use client';
import { createContext, useContext } from 'react';

export const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);
