import React from 'react';
import { User, Bell, Shield, Globe, Camera, Save, Mail, Phone, MapPin, Building, CreditCard } from 'lucide-react';
import { cn } from '../lib/utils';

import { useUser } from '../context/UserContext';

export function SettingsPage() {
  const { currentUser } = useUser();
  const [activeSection, setActiveSection] = React.useState('profile');

  if (!currentUser) return null;

  const initials = currentUser.name.split(' ').map(n => n[0]).join('');

  const navigation = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'business', label: 'Business Profile', icon: Building },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Globe },
    { id: 'billing', label: 'Plan & Billing', icon: CreditCard },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif font-bold text-natural-text-main">System Settings</h2>
          <p className="text-natural-text-light text-[0.8rem] font-medium uppercase tracking-wider">Configure your personalized workspace preferences</p>
        </div>
        
        <button className="flex items-center gap-2 bg-natural-accent text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-natural-accent/90 transition-all shadow-sm">
          <Save className="w-4 h-4" />
          Save All Changes
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="glass-card overflow-hidden">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all border-l-4",
                  activeSection === item.id
                    ? "bg-natural-bg/50 border-natural-accent text-natural-accent"
                    : "border-transparent text-natural-text-light hover:bg-natural-bg/30"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          {activeSection === 'profile' && (
            <div className="glass-card p-8 space-y-8 animate-in slide-in-from-bottom-2 duration-300">
               <div className="flex items-center gap-6">
                  <div className="relative group cursor-pointer">
                    <div className="w-24 h-24 rounded-full bg-natural-accent/10 border-2 border-natural-border flex items-center justify-center overflow-hidden">
                       <span className="text-2xl font-serif font-bold text-natural-accent">{initials}</span>
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <Camera className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-natural-text-main tracking-tight">{currentUser.name}</h3>
                    <p className="text-xs text-natural-text-light font-medium uppercase tracking-wider mb-3">{currentUser.role} Account</p>
                    <button className="text-[0.65rem] font-bold text-natural-accent border border-natural-accent/20 px-3 py-1 rounded hover:bg-natural-accent hover:text-white transition-all uppercase tracking-widest">Change Photo</button>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Full Name</label>
                    <div className="relative">
                       <User className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                       <input type="text" defaultValue={currentUser.name} className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Email Address</label>
                    <div className="relative">
                       <Mail className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                       <input type="email" defaultValue={currentUser.email} className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Contact Number</label>
                    <div className="relative">
                       <Phone className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                       <input type="tel" defaultValue={currentUser.phone} className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-natural-text-light uppercase tracking-widest">Location</label>
                    <div className="relative">
                       <MapPin className="absolute left-3 top-3 w-4 h-4 text-natural-text-light opacity-40" />
                       <input type="text" defaultValue="Metro Manila, Philippines" className="w-full pl-10 pr-4 py-2.5 bg-natural-bg/30 border border-natural-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-natural-accent/10 transition-all" />
                    </div>
                  </div>
               </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="glass-card p-8 space-y-6 animate-in slide-in-from-bottom-2 duration-300">
               <h3 className="text-lg font-bold text-natural-text-main tracking-tight font-serif italic border-b border-natural-border pb-4">Notification Preferences</h3>
               <div className="space-y-6">
                 {[
                   { label: 'Booking Confirmation', desc: 'Receive alerts when a deposit is paid.' },
                   { label: 'Low Stock Alerts', desc: 'Notify me when inventory reaches critical levels.' },
                   { label: 'Daily Analytics Summary', desc: 'Send a performance report every morning.' },
                   { label: 'Task Assignments', desc: 'Alert staff when they are assigned to an event.' }
                 ].map((opt, i) => (
                   <div key={i} className="flex items-center justify-between group">
                      <div>
                        <p className="text-sm font-bold text-natural-text-main tracking-tight">{opt.label}</p>
                        <p className="text-xs text-natural-text-light font-medium">{opt.desc}</p>
                      </div>
                      <div className="w-12 h-6 bg-natural-accent/80 rounded-full p-1 relative cursor-pointer shadow-inner">
                         <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {activeSection !== 'profile' && activeSection !== 'notifications' && (
            <div className="glass-card p-20 text-center flex flex-col items-center justify-center space-y-4">
               <div className="w-16 h-16 bg-natural-bg rounded-full flex items-center justify-center">
                  <Shield className="w-8 h-8 text-natural-text-light opacity-30" />
               </div>
               <div>
                 <h3 className="text-lg font-serif italic text-natural-text-main">Section Configuration</h3>
                 <p className="text-sm text-natural-text-light font-medium">The <span className="font-bold text-natural-accent">{activeSection}</span> settings module is currently being finalized.</p>
               </div>
               <button onClick={() => setActiveSection('profile')} className="text-[0.65rem] font-bold text-natural-text-light hover:text-natural-accent uppercase tracking-widest underline decoration-2 underline-offset-4 decoration-natural-border">Back to Profile</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
