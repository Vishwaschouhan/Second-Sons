import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import { FunctionTool } from '@google/adk';
import { adminDb } from '../tools/firebaseAdmin.js';

// --- Tools ---

const getUserProfile = new FunctionTool({
  name: 'get_user_profile',
  description: 'Retrieves the current user profile from Firestore, including name, phone, address, role, and medical history.',
  parameters: z.object({
    userId: z.string().describe('The Firebase UID of the current user'),
  }),
  execute: async ({ userId }) => {
    try {
      const snap = await adminDb.collection('users').doc(userId).get();
      if (!snap.exists) {
        return { status: 'error', message: 'User profile not found' };
      }
      const data = snap.data();
      return {
        status: 'success',
        profile: {
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          role: data.role || 'CUSTOMER',
          medicalHistory: data.medicalHistory || '',
        },
      };
    } catch (err) {
      console.error('[ProfileAgent] get_user_profile error:', err.message);
      return { status: 'error', message: `Failed to fetch profile: ${err.message}` };
    }
  },
});

const updateUserProfile = new FunctionTool({
  name: 'update_user_profile',
  description: 'Updates the user profile fields like phone and address in Firestore.',
  parameters: z.object({
    userId: z.string().describe('The Firebase UID of the current user'),
    phone: z.string().optional().describe('New phone number to set'),
    address: z.string().optional().describe('New address to set'),
  }),
  execute: async ({ userId, phone, address }) => {
    try {
      const updates = {};
      if (phone !== undefined && phone !== '') updates.phone = phone;
      if (address !== undefined && address !== '') updates.address = address;

      if (Object.keys(updates).length === 0) {
        return { status: 'error', message: 'No fields to update' };
      }

      await adminDb.collection('users').doc(userId).update(updates);
      return { status: 'success', message: 'Profile updated successfully', updatedFields: Object.keys(updates) };
    } catch (err) {
      console.error('[ProfileAgent] update_user_profile error:', err.message);
      return { status: 'error', message: `Failed to update profile: ${err.message}` };
    }
  },
});

// --- Agent ---

export const profileAgent = new LlmAgent({
  name: 'profile_agent',
  model: 'gemini-3-flash-preview',
  description: 'Handles user profile queries and updates. Can check and update user name, phone, and address.',
  instruction: `You are the Profile Agent for SecondSons app. Your job is to help users view and update their profile information.

CAPABILITIES:
- Retrieve user profile (name, phone, address, role)
- Update user phone number and address

RULES:
- The userId is provided in the system context of the user's message. Extract it from there and use it in all tool calls.
- When the user wants to update their profile, confirm what they want to change before calling the update tool.
- If the user has no address or phone set, inform them and offer to set it.
- Be friendly and concise in responses.`,
  tools: [getUserProfile, updateUserProfile],
});
