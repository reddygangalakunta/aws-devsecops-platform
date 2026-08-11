import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.utils.logger import logger
from app.utils.metrics import HTTP_REQUESTS_TOTAL, HTTP_REQUEST_DURATION_SECONDS
from app.routes.health import router as health_router
from app.routes.metrics import router as metrics_router
from app.routes.analyze import router as analyze_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.SERVICE_NAME} v{settings.VERSION} on port {settings.PORT}")
    yield
    logger.info(f"Shutting down {settings.SERVICE_NAME}")

app = FastAPI(
    title="CloudGuard Threat Analytics Microservice",
    description="Real-Time Security Event & Threat Analytics Service for DevSecOps Platform",
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Metrics & Latency Middleware
@app.middleware("http")
async def prometheus_and_logging_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    endpoint = request.url.path
    method = request.method
    
    try:
        response = await call_next(request)
        status_code = response.status_code
    except Exception as exc:
        status_code = 500
        logger.error(f"Unhandled exception during request {method} {endpoint}: {exc}", exc_info=True)
        raise exc
    finally:
        duration = time.perf_counter() - start_time
        # Record metrics for non-metrics endpoint to prevent recursion/noise if desired, or all
        HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status_code=status_code).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint).observe(duration)
        
    return response

# Mount routes
app.include_router(health_router)
app.include_router(metrics_router)
app.include_router(analyze_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
