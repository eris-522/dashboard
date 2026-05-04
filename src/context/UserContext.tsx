import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: string;
  status: string;
  phone: string;
  joined: string;
}

interface UserContextType {
  users: User[];
  currentUser: User | null;
  addUser: (user: Omit<User, 'id' | 'joined'>) => void;
  updateUser: (id: number, userData: Partial<User>) => void;
  archiveUser: (id: number) => void;
  removeUser: (id: number) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const DEFAULT_ADMIN: User = {
  id: 0,
  name: 'Kyle Erica Santos',
  email: 'santoskyleerica@gmail.com',
  password: 'admin123',
  phone: '09467158519',
  role: 'Admin',
  status: 'Active',
  joined: 'Apr 24, 2026'
};

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([DEFAULT_ADMIN]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  /**
   * Registers a new user in the system with a formatted join date.
   * @param userData User details excluding ID and automatic joined date.
   */
  const addUser = (userData: Omit<User, 'id' | 'joined'>) => {
    const newUser: User = {
      ...userData,
      id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
      joined: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    };
    setUsers(prev => [...prev, newUser]);
  };

  /**
   * Updates attributes of an existing user. Protects the system admin from external changes.
   * @param id The user's unique ID.
   * @param userData Partial object containing fields to update.
   */
  const updateUser = (id: number, userData: Partial<User>) => {
    if (id === 0) return; // Protect admin
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...userData } : u));
    if (currentUser?.id === id) {
      setCurrentUser(prev => prev ? { ...prev, ...userData } : null);
    }
  };

  const archiveUser = (id: number) => {
    if (id === 0) return; // Protect admin
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: 'Archived' } : u));
  };

  const removeUser = (id: number) => {
    if (id === 0) return; // Protect admin
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  /**
   * Authenticates a user based on email and password.
   * Only 'Active' or 'Inactive' users can log in; 'Archived' users are blocked.
   * @returns Promise resolving to true if login succeeded.
   */
  const login = async (email: string, password: string) => {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      if (user.status === 'Active' || user.status === 'Inactive') {
        setCurrentUser(user);
        return true;
      }
    }
    return false;
  };

  /**
   * Clears the current session by logging out the user.
   */
  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <UserContext.Provider value={{ users, currentUser, addUser, updateUser, archiveUser, removeUser, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
