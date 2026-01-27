import React, { createContext, useContext, useState, ReactNode } from 'react';
import { FeedbackModal, FeedbackType } from '../components/FeedbackModal';

interface FeedbackContextType {
    showFeedback: (title: string, message: string, type?: FeedbackType) => void;
    hideFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: FeedbackType;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'success',
    });

    const showFeedback = (title: string, message: string, type: FeedbackType = 'success') => {
        setConfig({
            visible: true,
            title,
            message,
            type,
        });
    };

    const hideFeedback = () => {
        setConfig(prev => ({ ...prev, visible: false }));
    };

    return (
        <FeedbackContext.Provider value={{ showFeedback, hideFeedback }}>
            {children}
            <FeedbackModal
                visible={config.visible}
                title={config.title}
                message={config.message}
                type={config.type}
                onConfirm={hideFeedback}
            />
        </FeedbackContext.Provider>
    );
}

export function useFeedback() {
    const context = useContext(FeedbackContext);
    if (context === undefined) {
        throw new Error('useFeedback must be used within a FeedbackProvider');
    }
    return context;
}
