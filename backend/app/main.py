from fastapi import FastAPI
from sqlalchemy import text

from app.database import Base, engine
from app import models
from app.routes.transit import router as transit_router
from app.routes.analytics import router as analytics_router
from fastapi.middleware.cors import CORSMiddleware



Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="NYC Transit Analytics API",
    description="Real-time and historical analytics for NYC transit data.",
    version="1.0.0",
)



app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(transit_router)
app.include_router(analytics_router)


@app.get("/")
def root():
    return {
        "message": "NYC Transit Analytics API is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.get("/health/database")
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected"
        }

    except Exception as exc:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(exc)
        }