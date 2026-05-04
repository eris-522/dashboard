import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface CateringPackage {
  id: number;
  name: string;
  type: string;
  pax: number;
  price: string;
  tag?: string;
  inclusions: string[];
  status: 'Available' | 'Archived';
}

interface PackageContextType {
  packages: CateringPackage[];
  addPackage: (pkg: Omit<CateringPackage, 'id' | 'status'>) => void;
  updatePackage: (id: number, pkg: Partial<CateringPackage>) => void;
  archivePackage: (id: number) => void;
  setPackages: (packages: CateringPackage[]) => void;
}

const PackageContext = createContext<PackageContextType | undefined>(undefined);

/**
 * Manages the catering packages globally.
 * Syncs the available bundles between Offerings Management and Booking Management.
 */
export function PackageProvider({ children }: { children: ReactNode }) {
  const [packages, setPackages] = useState<CateringPackage[]>([]);

  const addPackage = (data: Omit<CateringPackage, 'id' | 'status'>) => {
    const nextId = packages.length > 0 ? Math.max(...packages.map(p => p.id)) + 1 : 1;
    setPackages(prev => [...prev, { ...data, id: nextId, status: 'Available' }]);
  };

  const updatePackage = (id: number, data: Partial<CateringPackage>) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  };

  const archivePackage = (id: number) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, status: 'Archived' } : p));
  };

  return (
    <PackageContext.Provider value={{ packages, addPackage, updatePackage, archivePackage, setPackages }}>
      {children}
    </PackageContext.Provider>
  );
}

export function usePackage() {
  const context = useContext(PackageContext);
  if (context === undefined) {
    throw new Error('usePackage must be used within a PackageProvider');
  }
  return context;
}
