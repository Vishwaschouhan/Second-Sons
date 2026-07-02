import { LlmAgent, FunctionTool } from '@google/adk';
import { z } from 'zod';
import { adminDb } from '../tools/firebaseAdmin.js';
import admin from '../tools/firebaseAdmin.js';

// --- Tools ---

const createConsultation = new FunctionTool({
  name: 'create_consultation',
  description: 'Creates a medical consultation request in Firestore. Used when the user describes health symptoms or wants to see a doctor.',
  parameters: z.object({
    userId: z.string().describe('Firebase UID of the customer'),
    symptoms: z.string().describe('Description of symptoms or health concern'),
    preferredTime: z.string().optional().describe('Preferred consultation time in ISO format'),
  }),
  execute: async ({ userId, symptoms, preferredTime }) => {
    try {
      const docRef = await adminDb.collection('medicalConsultations').add({
        customerId: userId,
        doctorId: null,
        symptoms,
        preferredTime: preferredTime || null,
        status: 'pending',
        notes: '',
        prescription: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        status: 'success',
        message: `Medical consultation request created! Request ID: ${docRef.id}. A doctor will be assigned to review your symptoms.`,
        consultationId: docRef.id,
      };
    } catch (err) {
      console.error('[MedicalAgent] create_consultation error:', err.message);
      return { status: 'error', message: `Failed to create consultation: ${err.message}` };
    }
  },
});

const searchMedicines = new FunctionTool({
  name: 'search_medicines',
  description: 'Searches for medicines available in pharmacies.',
  parameters: z.object({
    searchTerm: z.string().describe('Medicine name or keyword to search'),
    limitCount: z.number().optional().describe('Max results to return (default 5)'),
  }),
  execute: async ({ searchTerm, limitCount }) => {
    try {
      const limit = limitCount || 5;

      const pharmacySnap = await adminDb.collection('users').where('role', '==', 'PHARMACY').get();
      const pharmacyIds = new Set(pharmacySnap.docs.map(d => d.id));

      const prodSnap = await adminDb.collection('products')
        .where('isAvailable', '==', true)
        .limit(100)
        .get();

      let results = prodSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => pharmacyIds.has(p.shopId));

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        results = results.filter(p => {
          const name = (p.name || '').toLowerCase();
          const generic = (p.genericName || '').toLowerCase();
          const brand = (p.brand || '').toLowerCase();
          return name.includes(term) || generic.includes(term) || brand.includes(term);
        });
      }

      const now = new Date();
      results = results.filter(p => {
        if (p.expiryDate) return new Date(p.expiryDate) > now;
        return true;
      });

      const formatted = results.slice(0, limit).map(p => ({
        id: p.id,
        name: p.name,
        genericName: p.genericName,
        brand: p.brand,
        dose: p.dose,
        price: p.price,
        shopId: p.shopId,
      }));

      return { status: 'success', medicines: formatted, totalFound: results.length };
    } catch (err) {
      console.error('[MedicalAgent] search_medicines error:', err.message);
      return { status: 'error', message: `Failed to search medicines: ${err.message}` };
    }
  },
});

const placeMedicineOrder = new FunctionTool({
  name: 'place_medicine_order',
  description: 'Places an order for medicine from a pharmacy.',
  parameters: z.object({
    userId: z.string().describe('Firebase UID of the customer'),
    productId: z.string().describe('The medicine product document ID'),
    shopId: z.string().describe('The pharmacy document ID'),
    quantity: z.number().describe('Quantity to order'),
    address: z.string().describe('Delivery address'),
  }),
  execute: async ({ userId, productId, shopId, quantity, address }) => {
    try {
      const productSnap = await adminDb.collection('products').doc(productId).get();
      if (!productSnap.exists) {
        return { status: 'error', message: 'Medicine not found.' };
      }
      const product = productSnap.data();

      if (product.expiryDate && new Date(product.expiryDate) < new Date()) {
        return { status: 'error', message: 'This medicine has expired and cannot be ordered.' };
      }

      const docRef = await adminDb.collection('commerceOrders').add({
        customerId: userId,
        shopId,
        productId,
        quantity,
        specialRequest: null,
        prescriptionUrl: null,
        status: 'pending',
        isRepeatable: false,
        repeatFrequency: null,
        deliveryPartnerId: null,
        address,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        status: 'success',
        message: `Medicine order placed! Order ID: ${docRef.id}. ${product.name} x${quantity} for ₹${product.price * quantity}.`,
        orderId: docRef.id,
      };
    } catch (err) {
      console.error('[MedicalAgent] place_medicine_order error:', err.message);
      return { status: 'error', message: `Failed to place medicine order: ${err.message}` };
    }
  },
});

const getUserProfileForMedical = new FunctionTool({
  name: 'get_user_profile_for_medical',
  description: 'Gets the user profile including medical history and address.',
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
        profile: {
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          medicalHistory: data.medicalHistory || '',
        },
      };
    } catch (err) {
      console.error('[MedicalAgent] get_user_profile error:', err.message);
      return { status: 'error', message: `Failed to fetch profile: ${err.message}` };
    }
  },
});

// --- Agent ---

export const medicalAgent = new LlmAgent({
  name: 'medical_agent',
  model: 'gemini-3-flash-preview',
  description: 'Handles health-related requests. Can schedule doctor consultations for symptoms and help order medicines from pharmacies.',
  instruction: `You are the Medical Agent for SecondSons app. You help users with health-related requests.

CAPABILITIES:
- Schedule doctor consultations when users describe health symptoms
- Search for and order medicines from pharmacies
- Access user's medical history for context

RULES:
- The userId is provided in the system context of the user's message. Extract it from there and use it in all tool calls.
- When the user describes SYMPTOMS (headache, fever, pain, cough, etc.):
  1. Express concern and empathy
  2. Recommend scheduling a doctor consultation
  3. Ask for preferred consultation time
  4. Create the consultation request
- When the user wants to ORDER MEDICINES:
  1. Search for the medicine
  2. Check user's address is set for delivery
  3. Recommend consulting a doctor first if it seems like a prescription medicine
  4. Place the order if user confirms
- Always be empathetic and caring about health concerns.
- Never provide medical advice or diagnoses — always recommend seeing a doctor.
- For medicine orders, verify address is available.
- Convert natural language dates to ISO format using the current date from system context.`,
  tools: [createConsultation, searchMedicines, placeMedicineOrder, getUserProfileForMedical],
});
