import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface AdditionalService {
  id: number;
  name: string;
  price: number;
  status: 'Active' | 'Archived';
}

interface ServicesContextType {
  additionalServices: AdditionalService[];
  addService: (service: Omit<AdditionalService, 'id' | 'status'>) => void;
  updateService: (id: number, service: Partial<AdditionalService>) => void;
  archiveService: (id: number) => void;
}

const ServicesContext = createContext<ServicesContextType | undefined>(undefined);

/**
 * Manages the global list of additional services (e.g., sound system, photo booth) 
 * that can be added to any catering booking.
 */
export function ServicesProvider({ children }: { children: ReactNode }) {
  const [additionalServices, setAdditionalServices] = useState<AdditionalService[]>([]);

  /**
   * Adds a new service to the catalog.
   */
  const addService = (data: Omit<AdditionalService, 'id' | 'status'>) => {
    const nextId = additionalServices.length > 0 ? Math.max(...additionalServices.map(s => s.id)) + 1 : 1;
    const newService: AdditionalService = {
      ...data,
      id: nextId,
      status: 'Active'
    };
    setAdditionalServices(prev => [...prev, newService]);
  };

  /**
   * Updates an existing service's name or price.
   */
  const updateService = (id: number, data: Partial<AdditionalService>) => {
    setAdditionalServices(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
  };

  /**
   * Archives a service so it no longer appears in booking selections.
   */
  const archiveService = (id: number) => {
    setAdditionalServices(prev => prev.map(s => s.id === id ? { ...s, status: 'Archived' } : s));
  };

  return (
    <ServicesContext.Provider value={{ additionalServices, addService, updateService, archiveService }}>
      {children}
    </ServicesContext.Provider>
  );
}

/**
 * Hook to access the additional services catalog.
 */
export function useServices() {
  const context = useContext(ServicesContext);
  if (context === undefined) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return context;
}
