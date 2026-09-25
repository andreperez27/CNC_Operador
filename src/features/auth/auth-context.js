import { createContext } from 'react';

// Objeto de contexto puro (sem componente): compartilhado pelo provider e
// pelo hook, cada um em seu próprio arquivo (regra only-export-components).
// Nome em kebab-case de propósito: evita colisão case-insensitive com
// AuthContext.jsx no Windows.
export const AuthContext = createContext(null);
