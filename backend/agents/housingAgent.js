import { LlmAgent, FunctionTool } from '@google/adk';
import { z } from 'zod';
import { adminDb } from '../tools/firebaseAdmin.js';
import admin from '../tools/firebaseAdmin.js';

// --- Tools ---

const searchProperties = new FunctionTool({
  name: 'search_properties',
  description: 'Searches for available housing properties in Firestore filtered by location, budget, and property type.',
  parameters: z.object({
    location: z.string().optional().describe('Location to search near (city, area name, etc.)'),
    maxPricePerDay: z.number().optional().describe('Maximum daily price in INR'),
    maxPricePerMonth: z.number().optional().describe('Maximum monthly price in INR'),
    propertyType: z.string().optional().describe('Type of property (e.g. 1BHK, 2BHK, PG, Flat, Room)'),
    limitCount: z.number().optional().describe('Max results to return (default 5)'),
  }),
  execute: async ({ location, maxPricePerDay, maxPricePerMonth, propertyType, limitCount }) => {
    try {
      const limit = limitCount || 5;
      const snap = await adminDb.collection('properties')
        .where('isActive', '==', true)
        .limit(50)
        .get();

      let results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (location) {
        const loc = location.toLowerCase();
        results = results.filter(p => {
          const addr = (p.address || '').toLowerCase();
          const title = (p.title || '').toLowerCase();
          return addr.includes(loc) || title.includes(loc);
        });
      }

      if (maxPricePerDay) {
        results = results.filter(p => p.pricePerDay && p.pricePerDay <= maxPricePerDay);
      }

      if (maxPricePerMonth) {
        results = results.filter(p => p.pricePerMonth && p.pricePerMonth <= maxPricePerMonth);
      }

      if (propertyType) {
        const pt = propertyType.toLowerCase();
        results = results.filter(p => (p.propertyType || '').toLowerCase().includes(pt));
      }

      const formatted = results.slice(0, limit).map(p => ({
        id: p.id,
        title: p.title,
        address: p.address,
        propertyType: p.propertyType,
        pricePerDay: p.pricePerDay,
        pricePerMonth: p.pricePerMonth,
        description: p.description,
        facilities: p.facilities,
        hostId: p.hostId,
      }));

      return {
        status: 'success',
        properties: formatted,
        totalFound: results.length,
        message: results.length > 0
          ? `Found ${results.length} matching properties.`
          : 'No properties found matching your criteria.',
      };
    } catch (err) {
      console.error('[HousingAgent] search_properties error:', err.message);
      return { status: 'error', message: `Failed to search properties: ${err.message}` };
    }
  },
});

const bookProperty = new FunctionTool({
  name: 'book_property',
  description: 'Creates a housing booking request in Firestore.',
  parameters: z.object({
    userId: z.string().describe('Firebase UID of the customer'),
    propertyId: z.string().describe('The property document ID to book'),
    stayType: z.enum(['DAY', 'LONG_TERM']).describe('DAY for daily/short-term, LONG_TERM for monthly'),
    startDate: z.string().describe('Start date in YYYY-MM-DD format'),
    endDate: z.string().optional().describe('End date in YYYY-MM-DD format (optional for long-term)'),
  }),
  execute: async ({ userId, propertyId, stayType, startDate, endDate }) => {
    try {
      const propSnap = await adminDb.collection('properties').doc(propertyId).get();
      if (!propSnap.exists) {
        return { status: 'error', message: 'Property not found.' };
      }
      const property = propSnap.data();

      const docRef = await adminDb.collection('bookings').add({
        propertyId,
        hostId: property.hostId || null,
        customerId: userId,
        stayType,
        startDate,
        endDate: endDate || null,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const priceInfo = stayType === 'DAY'
        ? (property.pricePerDay ? `₹${property.pricePerDay}/day` : '')
        : (property.pricePerMonth ? `₹${property.pricePerMonth}/month` : '');

      return {
        status: 'success',
        message: `Booking request created for "${property.title}"! Booking ID: ${docRef.id}. Stay type: ${stayType === 'DAY' ? 'Daily' : 'Monthly'}, starting ${startDate}. ${priceInfo}`,
        bookingId: docRef.id,
      };
    } catch (err) {
      console.error('[HousingAgent] book_property error:', err.message);
      return { status: 'error', message: `Failed to book property: ${err.message}` };
    }
  },
});

// --- Agent ---

export const housingAgent = new LlmAgent({
  name: 'housing_agent',
  model: 'gemini-3-flash-preview',
  description: 'Handles housing search and booking. Can search for rooms/flats/PGs by location and budget, and book them on daily or monthly basis.',
  instruction: `You are the Housing Agent for SecondSons app. You help users find and book housing (rooms, flats, PGs).

CAPABILITIES:
- Search for properties by location, budget, and type
- Book properties on daily or monthly basis

RULES:
- The userId is provided in the system context of the user's message. Extract it from there and use it in all tool calls.
- You MUST collect these details before booking:
  1. Location (where they want to stay)
  2. Stay type (daily or monthly) — ALWAYS ASK THIS
  3. Start date
  4. End date (required for daily stays, optional for monthly)
  5. Budget (optional but helpful for filtering)
- When the user asks for a room, FIRST search for available properties in the requested area.
- Present the results clearly with title, address, pricing, and property type.
- Let the user choose which property they want to book.
- Always ask whether they want daily or monthly rental before booking.
- Convert natural language dates to YYYY-MM-DD format using the current date from system context.
- If no properties match, tell the user and suggest broadening their search.
- Be concise and helpful.`,
  tools: [searchProperties, bookProperty],
});
