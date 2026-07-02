import { LlmAgent, FunctionTool } from '@google/adk';
import { z } from 'zod';
import { adminDb } from '../tools/firebaseAdmin.js';
import admin from '../tools/firebaseAdmin.js';

// --- Tools ---

const searchProducts = new FunctionTool({
  name: 'search_products',
  description: 'Searches for products in the Firestore products collection by name, category, or type. Returns matching available products with prices.',
  parameters: z.object({
    searchTerm: z.string().optional().describe('Product name or keyword to search for'),
    category: z.string().optional().describe('Product category to filter by'),
    shopType: z.enum(['SHOP', 'RESTAURANT', 'PHARMACY']).optional().describe('Filter by shop type'),
    limitCount: z.number().optional().describe('Max results to return (default 10)'),
  }),
  execute: async ({ searchTerm, category, shopType, limitCount }) => {
    try {
      const limit = limitCount || 10;
      const snap = await adminDb.collection('products').where('isAvailable', '==', true).limit(50).get();
      let results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (shopType) {
        const shopSnap = await adminDb.collection('users').where('role', '==', shopType).get();
        const shopIds = new Set(shopSnap.docs.map(d => d.id));
        results = results.filter(p => shopIds.has(p.shopId));
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        results = results.filter(p => {
          const name = (p.name || '').toLowerCase();
          const cat = (p.category || '').toLowerCase();
          const brand = (p.brand || '').toLowerCase();
          return name.includes(term) || cat.includes(term) || brand.includes(term);
        });
      }

      if (category) {
        const cat = category.toLowerCase();
        results = results.filter(p => (p.category || '').toLowerCase().includes(cat));
      }

      results.sort((a, b) => (a.price || Infinity) - (b.price || Infinity));

      const formatted = results.slice(0, limit).map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        brand: p.brand,
        shopId: p.shopId,
        stock: p.stock,
        isVeg: p.isVeg,
        type: p.type,
      }));

      return { status: 'success', products: formatted, totalFound: results.length };
    } catch (err) {
      console.error('[CommerceAgent] search_products error:', err.message);
      return { status: 'error', message: `Failed to search products: ${err.message}` };
    }
  },
});

const getOrderHistory = new FunctionTool({
  name: 'get_order_history',
  description: 'Fetches the user\'s past commerce orders to find frequently ordered or recently ordered items.',
  parameters: z.object({
    userId: z.string().describe('Firebase UID of the customer'),
    limitCount: z.number().optional().describe('Max number of orders to return (default 20)'),
  }),
  execute: async ({ userId, limitCount }) => {
    try {
      const limit = limitCount || 20;
      // Note: No orderBy to avoid composite index requirement — sort in JS
      const snap = await adminDb.collection('commerceOrders')
        .where('customerId', '==', userId)
        .limit(limit)
        .get();

      if (snap.empty) {
        return { status: 'success', orders: [], message: 'No order history found. This user has not placed any orders yet.' };
      }

      const productIds = [...new Set(snap.docs.map(d => d.data().productId).filter(Boolean))];
      const productMap = {};
      for (const pid of productIds) {
        try {
          const pSnap = await adminDb.collection('products').doc(pid).get();
          if (pSnap.exists) productMap[pid] = pSnap.data();
        } catch (_) { /* skip missing products */ }
      }

      const orders = snap.docs.map(doc => {
        const d = doc.data();
        const product = productMap[d.productId] || {};
        return {
          orderId: doc.id,
          productId: d.productId,
          productName: product.name || 'Unknown',
          productCategory: product.category || '',
          quantity: d.quantity,
          status: d.status,
          shopId: d.shopId,
          price: product.price,
        };
      });

      const freq = {};
      for (const o of orders) {
        freq[o.productId] = (freq[o.productId] || 0) + o.quantity;
      }

      return { status: 'success', orders, frequencyMap: freq, message: `Found ${orders.length} past orders.` };
    } catch (err) {
      console.error('[CommerceAgent] get_order_history error:', err.message);
      return { status: 'error', message: `Failed to fetch order history: ${err.message}` };
    }
  },
});

const placeOrder = new FunctionTool({
  name: 'place_order',
  description: 'Places a new commerce order in Firestore. Use this for grocery, food, or medicine orders.',
  parameters: z.object({
    userId: z.string().describe('Firebase UID of the customer'),
    productId: z.string().describe('The product document ID to order'),
    shopId: z.string().describe('The shop/restaurant/pharmacy document ID'),
    quantity: z.number().describe('Quantity to order'),
    address: z.string().describe('Delivery address'),
    specialRequest: z.string().optional().describe('Any special request (e.g. "no onion" for food)'),
  }),
  execute: async ({ userId, productId, shopId, quantity, address, specialRequest }) => {
    try {
      const productSnap = await adminDb.collection('products').doc(productId).get();
      if (!productSnap.exists) {
        return { status: 'error', message: 'Product not found.' };
      }
      const product = productSnap.data();
      if (!product.isAvailable) {
        return { status: 'error', message: 'This product is currently unavailable.' };
      }

      const docRef = await adminDb.collection('commerceOrders').add({
        customerId: userId,
        shopId,
        productId,
        quantity,
        specialRequest: specialRequest || null,
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
        message: `Order placed successfully! Order ID: ${docRef.id}. ${product.name} x${quantity} for ₹${product.price * quantity}.`,
        orderId: docRef.id,
        productName: product.name,
        totalPrice: product.price * quantity,
      };
    } catch (err) {
      console.error('[CommerceAgent] place_order error:', err.message);
      return { status: 'error', message: `Failed to place order: ${err.message}` };
    }
  },
});

const getUserProfile = new FunctionTool({
  name: 'get_user_profile_for_commerce',
  description: 'Gets the user profile to check delivery address and contact number.',
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
      console.error('[CommerceAgent] get_user_profile error:', err.message);
      return { status: 'error', message: `Failed to fetch profile: ${err.message}` };
    }
  },
});

// --- Agent ---

export const commerceAgent = new LlmAgent({
  name: 'commerce_agent',
  model: 'gemini-3-flash-preview',
  description: 'Handles shopping, grocery orders, food delivery, and medicine orders. Can search products, check order history, reorder usual items, and place new orders.',
  instruction: `You are the Commerce Agent for SecondSons app. You help users order groceries, food, and medicines.

CAPABILITIES:
- Search for products by name, category, or shop type (SHOP for groceries, RESTAURANT for food, PHARMACY for medicines)
- View order history to find user's "usual" or frequently ordered items
- Place new orders

RULES:
- The userId is provided in the system context of the user's message. Extract it from there (the "User ID:" field) and use it in all tool calls.
- Before placing any order, you MUST check the user profile to verify they have a delivery address set. If not, tell them to set it in their profile first.
- If the user says "order my usual X" or "reorder X":
  1. First check their order history using get_order_history
  2. Find the matching product(s) they've ordered before
  3. If found, confirm with the user and place the order
  4. If NOT found (new user or no matching orders), tell them "You don't have any previous orders for X" and search for available options to suggest
- When searching for products, show the user available options with prices and let them choose.
- For food orders from restaurants, ask about any special requests (e.g. "no onion", "extra spicy").
- For medicine orders, recommend consulting a doctor first.
- Always confirm the order details (product, quantity, price) before placing.
- Be concise and friendly.`,
  tools: [searchProducts, getOrderHistory, placeOrder, getUserProfile],
});
