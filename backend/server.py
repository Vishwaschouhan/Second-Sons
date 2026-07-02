from typing import Any, Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from intent_model import IntentModel
from nlu_utils import extract_slots, decide_followup

MODEL_PATH = "models/intent_model.joblib"

app = FastAPI(title="SecondSons NLU API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

intent_model = IntentModel.load(MODEL_PATH)


class NLURequest(BaseModel):
    message: str


class NLUResponse(BaseModel):
    intent: str
    slots: Dict[str, Any]
    missing_slots: List[str]
    followup_question: Optional[str]


class NLUContinueRequest(BaseModel):
    message: str
    intent: str
    previous_slots: Dict[str, Any] = {}


def apply_domain_heuristics(text: str, intent: str) -> str:
    """
    Apply lightweight domain rules on top of the ML model to fix obvious cases.
    For example, 'tap is leaking' and 'fan not working' => home_service.
    """
    lower = text.lower()

    home_keywords = [
        "tap",
        "pipe",
        "leak",
        "fan",
        "light",
        "lights",
        "bulb",
        "switch",
        "socket",
        "electrician",
        "water is leaking",
    ]
    grocery_keywords = [
        "biscuit",
        "biscuits",
        "milk",
        "bread",
        "egg",
        "eggs",
        "rice",
        "atta",
        "oil",
        "chocolate",
        "fanta",
        "cold drink",
        "juice",
    ]

    if any(hk in lower for hk in home_keywords) and not any(
        gk in lower for gk in grocery_keywords
    ):
        if intent in ("health_symptom", "order_grocery", "smalltalk_or_other"):
            return "home_service"

    return intent


@app.post("/nlu", response_model=NLUResponse)
async def nlu_endpoint(req: NLURequest) -> NLUResponse:
    text = req.message.strip()
    intent_raw = intent_model.predict_intent(text)
    intent = apply_domain_heuristics(text, intent_raw)

    slots = extract_slots(text, intent)
    missing_slots, followup_question = decide_followup(intent, slots)

    return NLUResponse(
        intent=intent,
        slots=slots,
        missing_slots=missing_slots,
        followup_question=followup_question,
    )


@app.post("/nlu/continue", response_model=NLUResponse)
async def nlu_continue(req: NLUContinueRequest) -> NLUResponse:
    """
    Used for follow-up messages when we ALREADY know the intent from a previous turn.
    We only extract new slots and merge with previous_slots, then recompute missing slots.

    IMPORTANT:
    - We do NOT overwrite symptom_text.
    - We do NOT overwrite service_category.
    This keeps the original symptom ("my head is paining") and original
    service category (e.g. Electrician for "fan not working").
    """
    text = req.message.strip()
    intent = req.intent
    prev_slots = req.previous_slots or {}

    new_slots = extract_slots(text, intent)
    combined_slots = {**prev_slots}
    for k, v in new_slots.items():
        if v is None:
            continue

        # Don't overwrite previously captured symptom_text
        if k == "symptom_text" and "symptom_text" in prev_slots:
            continue

        # Don't overwrite previously captured service_category
        if k == "service_category" and "service_category" in prev_slots:
            continue

        combined_slots[k] = v

    missing_slots, followup_question = decide_followup(intent, combined_slots)

    return NLUResponse(
        intent=intent,
        slots=combined_slots,
        missing_slots=missing_slots,
        followup_question=followup_question,
    )
