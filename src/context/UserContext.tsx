import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '../utils/supabase';
import { clearSignedUrlCache } from '../utils/storageMedia';

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
  isAuthChecking: boolean;
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

function isAuthorizedSingleAdmin(user: User): boolean {
  return user.status === 'Active' && user.role === 'Admin';
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [activeUserCount, setActiveUserCount] = useState<number>(0);
  const [totalUserCount, setTotalUserCount] = useState<number>(0);
  // Never synchronously hydrate unverified sessionStorage prior to verifying JWT + admins table
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsers = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [activeRes, totalRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Active'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true }),
      ]);

      if (activeRes.error) {
        console.error('Error fetching active profile count:', activeRes.error.message);
        return;
      }

      if (typeof activeRes.count === 'number') {
        setActiveUserCount(activeRes.count);
      }
      if (!totalRes.error && typeof totalRes.count === 'number') {
        setTotalUserCount(totalRes.count);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile counts:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const verifyExistingSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          const { data: adminProfile } = await supabase
            .from('admins')
            .select('id, name, email, role, status, phone_number, created_at')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!mounted) return;

          if (adminProfile) {
            const user = toUser(adminProfile);
            if (isAuthorizedSingleAdmin(user)) {
              setCurrentUser(user);
              sessionStorage.setItem('rp_admin_current_user', JSON.stringify(user));
              return;
            }
          }
          await supabase.auth.signOut();
        }

        sessionStorage.removeItem('rp_admin_current_user');
        setCurrentUser(null);
        setIsLoading(false);
      } catch {
        if (!mounted) return;
        sessionStorage.removeItem('rp_admin_current_user');
        setCurrentUser(null);
        setIsLoading(false);
      } finally {
        if (mounted) {
          setIsAuthChecking(false);
        }
      }
    };

    verifyExistingSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearSignedUrlCache();
        sessionStorage.removeItem('rp_admin_current_user');
        setCurrentUser(null);
        setUsers([]);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Only fetch customer profiles & open Realtime listeners once an authorized Admin session is verified
  useEffect(() => {
    if (!currentUser?.id) return;

    refreshUsers();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const profilesChannel = supabase
      .channel(`users-ctx-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            refreshUsers(true);
            window.dispatchEvent(new CustomEvent("profilesRealtimeSync"));
          }, 300);
        }
      )
      .subscribe();

    // Immediately evict session if the single Admin row is deactivated or modified out-of-band
    const adminGuardChannel = supabase
      .channel(`admin-guard-${currentUser.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "admins",
          filter: `id=eq.${currentUser.id}`,
        },
        async (payload: any) => {
          const updated = payload?.new;
          if (
            payload?.eventType === "DELETE" ||
            !updated ||
            updated.status !== "Active" ||
            updated.role !== "Admin"
          ) {
            clearSignedUrlCache();
            sessionStorage.removeItem("rp_admin_current_user");
            setCurrentUser(null);
            await supabase.auth.signOut();
          } else {
            const nextUser = toUser(updated);
            setCurrentUser(nextUser);
            try {
              sessionStorage.setItem("rp_admin_current_user", JSON.stringify(nextUser));
            } catch {}
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(adminGuardChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

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
    if (id === 0 || String(id) === '7dddf9d1-4b55-49df-8c77-61192afb2fd9') return;
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'Archived' } : u)));
  };

  const removeUser = (id: string | number) => {
    if (id === 0 || String(id) === '7dddf9d1-4b55-49df-8c77-61192afb2fd9') return;
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const login = async (email: string, password: string) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (!authError && authData?.user) {
        const { data: adminProfile } = await supabase
          .from('admins')
          .select('id, name, email, role, status, phone_number, created_at')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (adminProfile) {
          const user = toUser(adminProfile);
          if (isAuthorizedSingleAdmin(user)) {
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
    clearSignedUrlCache();
    supabase.auth.signOut().catch(console.error);
    sessionStorage.removeItem('rp_admin_current_user');
    setCurrentUser(null);
    setUsers([]);
    setActiveUserCount(0);
    setTotalUserCount(0);
  };

  return (
    <UserContext.Provider
      value={{
        users,
        currentUser,
        isLoading,
        isAuthChecking,
        refreshUsers,
        activeUserCount,
        totalUserCount,
        addUser,
        updateUser,
        archiveUser,
        removeUser,
        login,
        logout,
      }}>
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
