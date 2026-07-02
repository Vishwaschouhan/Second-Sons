import { LlmAgent, FunctionTool } from '@google/adk';
import { z } from 'zod';
import { adminDb } from '../tools/firebaseAdmin.js';
import admin from '../tools/firebaseAdmin.js';

// --- Tools ---

const createServiceRequest = new FunctionTool({
  name: 'create_service_request',
  description: 'Creates a home service request in Firestore for plumber, electrician, carpenter, etc.',
  parameters: z.object({
    userId: z.string().describe('Firebase UID of the customer'),
    category: z.enum([
      'Plumber', 'Electrician', 'Carpenter', 'Cleaner',
      'AC Repair', 'Painter', 'Gardener', 'Appliance Repair',
      'Labour', 'Other'
    ]).describe('Service category'),
    description: z.string().describe('Description of the problem or service needed'),
    address: z.string().describe('Address where the service is needed'),
    scheduledTime: z.string().optional().describe('Preferred date/time in ISO format'),
  }),
  execute: async ({ userId, category, description, address, scheduledTime }) => {
    try {
      const docRef = await adminDb.collection('serviceRequests').add({
        customerId: userId,
        category,
        description,
        address,
        scheduledTime: scheduledTime || null,
        status: 'pending',
        workerId: null,
        proposedPrice: null,
        proposedByWorkerId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        status: 'success',
        message: `${category} service request created! Request ID: ${docRef.id}. A worker will see your request and send a quote.`,
        requestId: docRef.id,
      };
    } catch (err) {
      console.error('[ServiceAgent] create_service_request error:', err.message);
      return { status: 'error', message: `Failed to create service request: ${err.message}` };
    }
  },
});

const getUserProfileForService = new FunctionTool({
  name: 'get_user_profile_for_service',
  description: 'Gets the user profile to check if address is set for home service.',
  parameters: z.object({
    userId: z.string().describe('Firebase UID of the user'),
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
        profile: { name: data.name || '', phone: data.phone || '', address: data.address || '' },
      };
    } catch (err) {
      console.error('[ServiceAgent] get_user_profile error:', err.message);
      return { status: 'error', message: `Failed to fetch profile: ${err.message}` };
    }
  },
});

// --- Agent ---

export const serviceAgent = new LlmAgent({
  name: 'service_agent',
  model: 'gemini-3-flash-preview',
  description: 'Handles home service requests like plumber, electrician, carpenter, cleaner, AC repair, painter, gardener, appliance repair, and general labour.',
  instruction: `You are the Home Service Agent for SecondSons app. You help users book home service workers.

CAPABILITIES:
- Create service requests for various categories
- Map user problem descriptions to the correct service category

CATEGORY MAPPING (use this to determine the right category from the user's description):
- "tap broken", "pipe leak", "water leak", "toilet issue", "sink problem" → Plumber
- "fan not working", "light issue", "switch sparking", "wiring", "power problem" → Electrician
- "door repair", "furniture fix", "wood work", "table broken" → Carpenter
- "cleaning", "deep clean", "maid", "sweep", "mop" → Cleaner
- "AC not cooling", "air conditioner repair", "AC service" → AC Repair
- "painting", "wall paint", "repaint" → Painter
- "garden", "lawn", "plants", "tree trimming" → Gardener
- "fridge repair", "washing machine", "TV repair", "microwave", "geyser" → Appliance Repair
- "shifting", "heavy lifting", "manual work" → Labour
- Anything else → Other

RULES:
- The userId is provided in the system context of the user's message. Extract it from there and use it in all tool calls.
- Before creating a request, ALWAYS check the user's profile to verify they have an address set.
- If no address is set, ask them for their address so you can include it in the request.
- You MUST collect:
  1. Problem description (what's wrong)
  2. Category (auto-detect from description, confirm with user)
  3. Address (from profile or ask user)
  4. Preferred time (optional, ask the user)
- Be empathetic about their problems and assure them help is on the way.
- Convert natural language dates to ISO format using the current date from the system context.`,
  tools: [createServiceRequest, getUserProfileForService],
});
