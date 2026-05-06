from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from ai.service import router as ai_router
from arena import router as arena_router
from app.database import Base, engine
from app.models import *  # noqa: F401,F403

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Nishon Arena API",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Faqat universitet frontend ishlatadigan minimal router qoldirildi.
# Shu sababli eski CRUD endpointlar (region, branch, user, employee, result) olib tashlandi.
app.include_router(ai_router)
app.include_router(arena_router)
