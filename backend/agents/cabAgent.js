import { LlmAgent, FunctionTool } from '@google/adk';
import { z } from 'zod';
import { adminDb } from '../tools/firebaseAdmin.js';
import admin from '../tools/firebaseAdmin.js';

// --- Tools ---

const bookCab = new FunctionTool({
  name: 'book_cab',
  description: 'Creates a new cab booking request in Firestore.',
  parameters: z.object({
    userId: z.string().describe('Firebase UID of the customer'),
    pickupLocation: z.string().describe('Pickup location'),
    dropLocation: z.string().describe('Drop-off location'),
    scheduledTime: z.string().optional().describe('Scheduled date and time in ISO format (e.g. 2026-03-24T12:00:00)'),
    notes: z.string().optional().describe('Additional notes for the driver'),
    maxBudget: z.number().optional().describe('Maximum budget the customer is willing to pay in INR'),
  }),
  execute: async ({ userId, pickupLocation, dropLocation, scheduledTime, notes, maxBudget }) => {
    try {
      const docRef = await adminDb.collection('cabRequests').add({
        customerId: userId,
        pickupLocation,
        dropLocation,
        scheduledTime: scheduledTime || null,
        notes: notes || '',
        maxBudget: maxBudget || null,
        status: 'pending',
        driverId: null,
        proposedPrice: null,
        proposedByDriverId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return {
        status: 'success',
        message: `Cab request created successfully! Request ID: ${docRef.id}. A driver will send you a quote soon.${maxBudget ? ` Quotes under ₹${maxBudget} will be auto-accepted.` : ''}`,
        requestId: docRef.id,
        details: { pickupLocation, dropLocation, scheduledTime, maxBudget },
      };
    } catch (err) {
      console.error('[CabAgent] book_cab error:', err.message);
      return { status: 'error', message: `Failed to book cab: ${err.message}` };
    }
  },
});

const getCabRequests = new FunctionTool({
  name: 'get_cab_requests',
  description: 'Fetches the user\'s cab requests from Firestore to check status, quotes, etc.',
  parameters: z.object({
    userId: z.string().describe('Firebase UID of the customer'),
    limitCount: z.number().optional().describe('Max number of requests to return (default 5)'),
  }),
  execute: async ({ userId, limitCount }) => {
    try {
      const limit = limitCount || 5;
      // Note: No orderBy to avoid composite index requirement — sort in JS
      const snap = await adminDb.collection('cabRequests')
        .where('customerId', '==', userId)
        .limit(limit)
        .get();

      const requests = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          pickupLocation: d.pickupLocation,
          dropLocation: d.dropLocation,
          scheduledTime: d.scheduledTime,
          status: d.status,
          proposedPrice: d.proposedPrice,
          proposedByDriverId: d.proposedByDriverId,
          maxBudget: d.maxBudget,
          driverId: d.driverId,
        };
      });

      return { status: 'success', requests };
    } catch (err) {
      console.error('[CabAgent] get_cab_requests error:', err.message);
      return { status: 'error', message: `Failed to fetch cab requests: ${err.message}` };
    }
  },
});

const acceptCabQuote = new FunctionTool({
  name: 'accept_cab_quote',
  description: 'Accepts a driver\'s quote for a cab request. Only works if status is "quoted" and a driver has proposed a price.',
  parameters: z.object({
    requestId: z.string().describe('The cab request document ID'),
  }),
  execute: async ({ requestId }) => {
    try {
      const docRef = adminDb.collection('cabRequests').doc(requestId);
      const snap = await docRef.get();

      if (!snap.exists) {
        return { status: 'error', message: 'Cab request not found' };
      }

      const data = snap.data();
      if (data.status !== 'quoted') {
        return { status: 'error', message: `Cannot accept quote. Current status is "${data.status}".` };
      }

      if (!data.proposedByDriverId || typeof data.proposedPrice !== 'number') {
        return { status: 'error', message: 'No valid driver quote found on this request.' };
      }

      await docRef.update({
        status: 'accepted',
        driverId: data.proposedByDriverId,
      });

      return {
        status: 'success',
        message: `Quote of ₹${data.proposedPrice} accepted! Driver has been assigned.`,
        price: data.proposedPrice,
      };
    } catch (err) {
      console.error('[CabAgent] accept_cab_quote error:', err.message);
      return { status: 'error', message: `Failed to accept quote: ${err.message}` };
    }
  },
});

const autoAcceptCabQuotes = new FunctionTool({
  name: 'auto_accept_cab_quotes',
  description: 'Checks all user cab requests with status "quoted" and auto-accepts any where the proposed price is within the max budget.',
  parameters: z.object({
    userId: z.string().describe('Firebase UID of the customer'),
  }),
  execute: async ({ userId }) => {
    try {
      const snap = await adminDb.collection('cabRequests')
        .where('customerId', '==', userId)
        .where('status', '==', 'quoted')
        .get();

      const results = [];
      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.maxBudget && typeof data.proposedPrice === 'number' && data.proposedPrice <= data.maxBudget) {
          await doc.ref.update({
            status: 'accepted',
            driverId: data.proposedByDriverId,
          });
          results.push({
            requestId: doc.id,
            action: 'accepted',
            price: data.proposedPrice,
            budget: data.maxBudget,
          });
        }
      }

      if (results.length === 0) {
        return { status: 'success', message: 'No quotes within budget found to auto-accept.' };
      }

      return {
        status: 'success',
        message: `Auto-accepted ${results.length} cab quote(s) within budget.`,
        accepted: results,
      };
    } catch (err) {
      console.error('[CabAgent] auto_accept_cab_quotes error:', err.message);
      return { status: 'error', message: `Failed to auto-accept quotes: ${err.message}` };
    }
  },
});

// --- Agent ---

export const cabAgent = new LlmAgent({
  name: 'cab_agent',
  model: 'gemini-3-flash-preview',
  description: 'Handles cab booking requests. Can book cabs, check cab request status, accept driver quotes, and auto-accept quotes within budget.',
  instruction: `You are the Cab Booking Agent for SecondSons app. You help users book cabs and manage their cab requests.

CAPABILITIES:
- Book a new cab with pickup location, drop location, scheduled time, and optional budget
- Check status of existing cab requests  
- Accept driver quotes manually
- Auto-accept driver quotes that are within the user's budget

RULES:
- The userId is provided in the system context of the user's message. Extract it from there and use it in all tool calls.
- You MUST collect these required fields before booking:
  1. Pickup location
  2. Drop-off location
- Ask for optional fields if the user mentions them:
  - Scheduled time (convert natural language dates to ISO format, e.g. "tomorrow at 12pm" → compute the actual date using the current date from system context)
  - Budget/maximum price they're willing to pay
  - Notes for the driver
- If the user mentions a budget, set maxBudget so quotes can be auto-accepted.
- When the user says things like "tomorrow", "today", "next Monday", calculate the actual date using the current date provided in system context.
- After booking, inform the user that a driver will send a quote and if they set a budget, quotes within budget will be auto-accepted.
- Be concise and friendly.`,
  tools: [bookCab, getCabRequests, acceptCabQuote, autoAcceptCabQuotes],
});
