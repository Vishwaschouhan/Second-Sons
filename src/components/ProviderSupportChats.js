import React, { useState, useEffect } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import ChatWindow from './ChatWindow';

const ProviderSupportChats = ({ user }) => {
    const [supportChats, setSupportChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);

    useEffect(() => {
        if (!user) return;

        // Query chats where the user is a participant and type is 'support'
        // Note: We need to ensure we create chats with these fields.
        // Since 'participants' is an array, we use 'array-contains'.
        const q = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', user.uid),
            where('type', '==', 'support')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            setSupportChats(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        });

        return () => unsub();
    }, [user]);

    // if (supportChats.length === 0) return null; // Commented out to ensure visibility

    return (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ff9800', backgroundColor: '#fff3e0' }}>
            <h3>Support Chats</h3>
            {supportChats.length === 0 ? (
                <p>No active support chats.</p>
            ) : (
                <>
                    <p>You have active chats with Customer Support.</p>
                    <ul>
                        {supportChats.map((chat) => (
                            <li key={chat.id} style={{ marginBottom: '5px' }}>
                                Chat ID: {chat.id}
                                <button
                                    onClick={() => setActiveChatId(chat.id)}
                                    style={{ marginLeft: '10px' }}
                                >
                                    Open Chat
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {activeChatId && (
                <ChatWindow
                    requestId={activeChatId}
                    currentUser={user}
                    onClose={() => setActiveChatId(null)}
                    title="Support Chat"
                />
            )}
        </div>
    );
};

export default ProviderSupportChats;
