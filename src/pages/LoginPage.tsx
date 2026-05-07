import React, { useState } from 'react';
import { Mail, Lock, LogIn, Utensils, AlertCircle, Loader2 } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { motion } from 'motion/react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login, currentUser } = useUser();

  if (currentUser) {
    return (
      <div className="min-h-screen bg-natural-bg flex items-center justify-center p-6 bg-[url('https://images.unsplash.com/photo-1519222970733-f546218fa6d7?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center">
        <div className="absolute inset-0 bg-natural-sidebar/40 backdrop-blur-xs" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative"
        >
          <div className="glass-card p-10 shadow-2xl border-white/20 text-center">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 bg-natural-accent rounded-2xl flex items-center justify-center mb-4 shadow-lg rotate-3" />
              <h1 className="text-2xl font-serif font-bold text-natural-text-main">Already signed in</h1>
              <p className="text-natural-text-light text-[0.8rem] font-bold uppercase tracking-[0.2em] mt-2">
                Welcome back, {currentUser.name}
              </p>
            </div>

            <p className="text-natural-text-light/90 text-sm font-medium">
              You are already authenticated. Redirecting to your dashboard...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  /**
   * Processes the login form submission.
   * Authenticates the user via UserContext and handles loading/error states.
   * @param e React form event
   */
  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (!success) {
        setError('Invalid email or password. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-natural-bg flex items-center justify-center p-6 bg-[url('https://images.unsplash.com/photo-1519222970733-f546218fa6d7?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-natural-sidebar/40 backdrop-blur-xs" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative"
      >
        <div className="glass-card p-10 shadow-2xl border-white/20">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-natural-accent rounded-2xl flex items-center justify-center mb-4 shadow-lg rotate-3">
              <Utensils className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-natural-text-main text-center">Roxan Policarpio Events & Catering</h1>
            <p className="text-natural-text-light text-[0.7rem] font-bold uppercase tracking-[0.2em] mt-2">Management Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest pl-1">Email Address</label>
              <div className="relative">
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
                  placeholder="admin@example.com"
                />
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-natural-text-light" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest pl-1">Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white/50 border border-natural-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 focus:bg-white transition-all shadow-xs"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-natural-text-light" />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-[0.7rem] font-bold"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-natural-accent hover:bg-natural-accent/90 text-white rounded-xl text-[0.7rem] font-bold uppercase tracking-[0.2em] shadow-lg shadow-natural-accent/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-natural-border flex flex-col items-center gap-4">
             <p className="text-[10px] font-medium text-natural-text-light text-center">
                Restricted access for Roxan Policarpio Events & Catering authorized personnel only. 
                All activities are monitored and logged.
             </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
