// src/lib/context/GlobalContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createSPASassClientAuthenticated as createSPASassClient } from '@/lib/supabase/client';


type User = {
    email: string;
    id: string;
    registered_at: Date;
};

interface GlobalContextType {
    loading: boolean;
    user: User | null;  // Add this
    isAdmin: boolean;   // Whether the current user has the 'admin' role
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);  // Add this
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        async function loadData() {
            try {
                const supabase = await createSPASassClient();
                const client = supabase.getSupabaseClient();

                // Get user data
                const { data: { user } } = await client.auth.getUser();
                if (user) {
                    setUser({
                        email: user.email!,
                        id: user.id,
                        registered_at: new Date(user.created_at)
                    });

                    // Look up the user's role in user_data
                    const { data: userData } = await client
                        .from('user_data')
                        .select('user_role')
                        .eq('user_id', user.id)
                        .maybeSingle();

                    setIsAdmin(userData?.user_role === 'admin');
                } else {
                    throw new Error('User not found');
                }

            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    return (
        <GlobalContext.Provider value={{ loading, user, isAdmin }}>
            {children}
        </GlobalContext.Provider>
    );
}

export const useGlobal = () => {
    const context = useContext(GlobalContext);
    if (context === undefined) {
        throw new Error('useGlobal must be used within a GlobalProvider');
    }
    return context;
};