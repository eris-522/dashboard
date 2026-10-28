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
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = sessionStorage.getItem('rp_admin_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
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

    // Check for an existing session to auto-login the admin, and kick out unauthorized customers
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: adminProfile } = await supabase
          .from('admins')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (adminProfile) {
          const user = toUser(adminProfile);
          if (user.status === 'Active' || user.status === 'Inactive') {
            setCurrentUser(user);
            sessionStorage.setItem('rp_admin_current_user', JSON.stringify(user));
          } else {
            await supabase.auth.signOut();
            sessionStorage.removeItem('rp_admin_current_user');
            setCurrentUser(null);
          }
        } else {
          await supabase.auth.signOut(); // Kick out if they are a customer (not in admins table)
          sessionStorage.removeItem('rp_admin_current_user');
          setCurrentUser(null);
        }
      }
    });

    // Subscribe to real-time changes on the profiles table so Dashboard metrics stay synced
    const channel = supabase
      .channel(`users-ctx-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          refreshUsers(true);
        }
      )
      .subscribe();

    return () => {
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
      setCurrentUser((prev) => {
        const updated = prev ? { ...prev, ...userData } : null;
        if (updated) {
          sessionStorage.setItem('rp_admin_current_user', JSON.stringify(updated));
        }
        return updated;
      });
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

  const login = async (email: string, password: string) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    // 1. Primary Hardcoded Admin Access (works anywhere: localhost and production on Vercel)
    if (cleanEmail === 'erica@gmail.com' && cleanPassword === 'admin123') {
      const adminUser: User = {
        id: 0,
        name: 'Kyle Erica Santos',
        email: 'erica@gmail.com',
        role: 'Admin',
        status: 'Active',
        phone: '09467158519',
        joined: 'Apr 24, 2026',
      };
      setCurrentUser(adminUser);
      sessionStorage.setItem('rp_admin_current_user', JSON.stringify(adminUser));
      return true;
    }

    // 2. Supabase Auth authentication for database-registered admin users
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!authError && authData?.user) {
        // System pulls from the 'admins' table to verify admin privileges
        const { data: adminProfile } = await supabase
          .from('admins')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (adminProfile) {
          const user = toUser(adminProfile);
          if (user.status === 'Active' || user.status === 'Inactive') {
            setCurrentUser(user);
            sessionStorage.setItem('rp_admin_current_user', JSON.stringify(user));
            return true;
          }
        }
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Supabase login failed:', err);
    }

    return false;
  };

  const logout = () => {
    supabase.auth.signOut().catch(console.error);
    sessionStorage.removeItem('rp_admin_current_user');
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
