import React from 'react';
import { useAuth } from '../../AuthContext';
import ProviderSupportChats from '../../components/ProviderSupportChats';

const ProviderSupportPage = () => {
    const { user } = useAuth();

    return (
        <div style={{ padding: '20px' }}>
            <h1>Support Chats</h1>
            <ProviderSupportChats user={user} />
        </div>
    );
};

export default ProviderSupportPage;
