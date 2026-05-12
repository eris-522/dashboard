import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '../utils/supabase';

export interface User {
  id: string | number;
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
  isLoading: boolean;
  refreshUsers: (silent?: boolean) => Promise<void>;
  activeUserCount: number;
  totalUserCount: number;
  addUser: (user: Omit<User, 'id' | 'joined'>) => void;
  updateUser: (id: string | number, userData: Partial<User>) => void;
  archiveUser: (id: string | number) => void;
  removeUser: (id: string | number) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function toUser(row: any): User {
  return {
    id: row?.id ?? 0,
    name: row?.name || row?.full_name || row?.fullName || '',
    email: row?.email ?? '',
    password: row?.password,
    role: row?.role ?? 'Customer',
    status: row?.status ?? 'Inactive',
    phone: row?.phone_number ?? row?.phone ?? '',
    joined: row?.joined ?? row?.created_at ?? '',
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsers = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching profiles:', error.message);
        return;
      }

      if (data) {
        setUsers((data as any[]).map(toUser));
      }
    } catch (err) {
      console.error('Unexpected error fetching profiles:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUsers();

    // Fallback polling: Refresh users silently every 10 seconds 
    // in case real-time WebSockets fail or drop.
    const intervalId = setInterval(() => refreshUsers(true), 10000);

    // Subscribe to real-time changes on the profiles table so Dashboard metrics stay synced
    const channel = supabase
      .channel("users-channel-context")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          refreshUsers(true);
        }
      )
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalUserCount = users.filter((u) => u.id !== 0).length;
  const activeUserCount = useMemo(
    () => users.filter((u) => u.id !== 0 && u.status === 'Active').length,
    [users],
  );

  /**
   * Registers a new user in the system with a formatted join date.
   * NOTE: This is local-only behavior; the real DB create flow is in UserPage.
   */
  const addUser = (userData: Omit<User, 'id' | 'joined'>) => {
    const newUser: User = {
      ...userData,
      id: users.length > 0 ? Math.max(...users.map((u) => typeof u.id === 'number' ? u.id : 0)) + 1 : 1,
      joined: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    };
    setUsers((prev) => [...prev, newUser]);
  };

  const updateUser = (id: string | number, userData: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...userData } : u)));
    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...userData } : null));
    }
  };

  const archiveUser = (id: string | number) => {
    if (id === 0) return; // Protect admin
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'Archived' } : u)));
  };

  const removeUser = (id: string | number) => {
    if (id === 0) return; // Protect admin
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  // NOTE: This local login is used only in parts of the app relying on in-memory auth.
  // Your UserPage creates users via Supabase Auth.
  const login = async (email: string, password: string) => {
    try {
      // Attempt actual authentication via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!authError && authData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profile) {
          const user = toUser(profile);
          if (user.status === 'Active' || user.status === 'Inactive') {
            setCurrentUser(user);
            return true;
          }
        }
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Supabase login failed:', err);
    }

    // Development-only fallback
    if (import.meta.env.DEV && email === 'erica@gmail.com' && password === 'admin123') {
      setCurrentUser({
        id: 0,
        name: 'Kyle Erica Santos',
        email: 'erica@gmail.com',
        role: 'Admin',
        status: 'Active',
        phone: '09467158519',
        joined: 'Apr 24, 2026',
      });
      return true;
    }

    return false;
  };

  const logout = () => {
    supabase.auth.signOut().catch(console.error);
    setCurrentUser(null);
  };

  return (
    <UserContext.Provider
      value={{
        users,
        currentUser,
        isLoading,
        refreshUsers,
        activeUserCount,
        totalUserCount,
        addUser,
        updateUser,
        archiveUser,
        removeUser,
        login,
        logout,
      }}
    >
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
