# SecondSons - Hyperlocal Services & Commerce Platform

SecondSons is a comprehensive hyperlocal platform designed to bridge the gap between digital convenience and local needs. It integrates quick commerce, food delivery, pharmacy services, home maintenance, cab booking, housing assistance, and health consultations into a single, user-friendly application.

## 🚀 Features

### 🛒 Commerce & Delivery
- **Quick Commerce**: Order groceries and daily essentials from local shops.
- **Food Delivery**: Order food from nearby restaurants with support for special requests.
- **Pharmacy**: Order medicines by uploading prescriptions or selecting from a catalog.
- **Product Details**: Comprehensive product pages with images, descriptions, ratings, and reviews.
- **Multiple Image Uploads**: Providers can showcase products with image galleries.
- **Subscriptions**: Subscribe to essentials with flexible delivery frequencies (Daily, Weekly, Monthly).

### �️ Services & Utility
- **Home Services**: Book electricians, plumbers, carpenters, and more.
- **Cab Booking**: Request rides with origin and destination.
- **Housing**: Search and book hostels, PGs, or rental rooms.
- **Health**: Log symptoms and consult with doctors.

### 🤖 AI Assistant
- **Text Interface**: Interact with the platform using natural language.
- **Context-Aware**: Remembers previous interactions for a smooth conversation flow.
- **Action-Oriented**: Can trigger real-world actions like placing orders or booking services directly from the chat.

## � Tech Stack

### Frontend
- **React.js**: Core framework for the user interface.
- **Firebase SDK**: For authentication, database, and storage interactions.
- **React Router**: For client-side routing.

### Backend & Services
- **Firebase**:
    - **Authentication**: User management (Customer, Shop, Restaurant, Pharmacy, Worker, Doctor).
    - **Firestore**: NoSQL database for real-time data syncing.
    - **Storage**: Cloud storage for images and documents.
- **Python (FastAPI)**: Backend server for the AI assistant and NLU processing.
- **Cloudinary**: For optimized image management.

### AI & Machine Learning
- **Scikit-learn**: For the Intent Classifier.
- **NLTK / Spacy**: For Natural Language Processing tasks.
- **Pandas**: For data manipulation.

---

## 🧠 AI System Architecture

The AI Assistant is a core differentiator of SecondSons, enabling natural language interactions. It is a two-part AI system comprising an Intent Classifier (ML model) and a Slot Extractor (Rule-based).

### 1. Intent Classifier
The intent classifier determines what the user wants to do based on their message.

*   **Location**:
    *   Training: `backend/train_intent_model.py`
    *   Runtime wrapper: `backend/intent_model.py`
    *   Saved model: `backend/models/intent_model.joblib`

*   **Architecture**:
    It utilizes a **scikit-learn Pipeline**:
    1.  **TfidfVectorizer**: Converts text to numeric features.
        *   `lowercase=True`
        *   `ngram_range=(1, 2)` (Unigrams + Bigrams)
    2.  **MLPClassifier**: A Multi-Layer Perceptron neural network.
        *   Hidden layer: `(64,)`
        *   Activation: `ReLU`
        *   Solver: `Adam`
        *   `max_iter=80`

*   **Supported Intents**:
    *   `order_grocery`
    *   `book_housing`
    *   `housing_search`
    *   `book_cab`
    *   `home_service`
    *   `health_symptom`
    *   `doctor_consult`
    *   `smalltalk_or_other`

*   **Training Data**:
    *   Defined in `build_training_data()` as a list of `(text, intent)` pairs.
    *   Covers phrases for ordering, booking, symptoms, and small talk.

### 2. Slot Extractor (Rule-based NLU)
Once the intent is identified, the slot extractor pulls out structured information required for business logic.

*   **Location**: `backend/nlu_utils.py`
*   **Extracted Slots**:
    *   **Quantity**: `quantity_value`, `quantity_unit` (e.g., "1 litre", "2 packets")
    *   **Product**: `product_name`, `product_category` (e.g., "biscuit", "fanta")
    *   **Cab**: `origin`, `destination` (e.g., "from X to Y")
    *   **Housing**: `location`, `booking_mode` ("DAILY" vs "MONTHLY")
    *   **Time**: `datetime_iso`, `datetime_text` (via `dateparser`)
    *   **Health**: `symptom_text`
    *   **Service Category**: Maps text like "fan not working" to "Electrician" or "tap leaking" to "Plumber".

*   **Follow-up Logic**:
    The system checks for missing required slots and decides if a follow-up question is needed (e.g., asking for time if missing in a cab request).

### 3. Serving & Conversation State
*   **API Layer**: `backend/server.py` (FastAPI)
    *   `POST /nlu`: Initial processing of a message.
    *   `POST /nlu/continue`: Handles multi-turn conversations by merging new slots with previous context.
*   **Frontend Integration**: `src/pages/assistant/AiAssistant.js`
    *   Maintains `pendingNLU` state (`intent`, `slots`).
    *   Routes messages to `/nlu` or `/nlu/continue`.
    *   Triggers client-side handlers (e.g., `handleOrderGrocery`, `handleBookCab`) once all slots are filled.

### 4. Extending the Model
To add new services (e.g., Food Delivery), the process involves:
1.  **Add New Intent**: Add `"order_food"` to `INTENTS` and provide training examples in `backend/train_intent_model.py`.
2.  **Extend Slot Extraction**: Update `backend/nlu_utils.py` to extract relevant fields (e.g., `restaurant_name`, `dish_name`).
3.  **Update Domain Heuristics**: Add keywords to `apply_domain_heuristics` in `backend/server.py` to guide the classifier.
4.  **Frontend Handlers**: Implement `handleOrderFood` in `AiAssistant.js` to execute the action.

---

## �️ Setup Instructions

### Prerequisites
- Node.js & npm/yarn
- Python 3.8+
- Firebase Project

### Frontend Setup
1.  Navigate to the project root:
    ```bash
    cd secondsons
    ```
2.  Install dependencies:
    ```bash
    yarn install
    ```
3.  Start the development server:
    ```bash
    yarn start
    ```

### Backend (AI) Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Train the model:
    ```bash
    python train_intent_model.py
    ```
5.  Start the API server:
    ```bash
    uvicorn server:app --reload
    ```

### Firebase Setup
1.  Create a Firebase project.
2.  Enable Authentication (Email/Password).
3.  Create a Firestore Database.
4.  Copy your Firebase config keys into `src/firebase.js`.

