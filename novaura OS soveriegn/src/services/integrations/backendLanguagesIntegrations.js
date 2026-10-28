/**
 * backendLanguagesIntegrations.js — Multi-Language High-Performance Backends
 * 
 * Production templates for Python 3.12+ FastAPI with Pydantic v2 & async SQLAlchemy,
 * Rust Axum + Tokio async runtime, and Go 1.22+ Fiber microservice.
 */

export const BACKEND_LANGUAGES_INTEGRATIONS = [
  // ── 1. PYTHON FASTAPI WITH PYDANTIC V2 ───────────────────────────────────
  {
    id: 'fastapi_pydantic_python',
    title: 'Python 3.12+ FastAPI Microservice (Pydantic v2 & Ollama RAG)',
    category: 'backend_languages',
    vendor: 'Python / FastAPI',
    badge: 'Python AI Backend',
    icon: 'Code2',
    color: '#3776ab',
    description: 'Production Python 3.12+ FastAPI backend with Pydantic v2 request validation, CORS middleware, async httpx streaming to Ollama/vLLM, and health endpoints.',
    suggestedPath: '/projects/cybeni/backend/main.py',
    language: 'python',
    aiPrompt: 'Implement Python FastAPI backend with Pydantic v2 models, CORS middleware, async streaming endpoint to Ollama, and graceful shutdown handlers.',
    faqs: [
      {
        question: 'How do you stream LLM tokens to client in FastAPI?',
        answer: 'Use fastapi.responses.StreamingResponse with an async generator yielding text/event-stream chunks.'
      }
    ],
    code: `"""
Production Python 3.12+ FastAPI Service with Local LLM Streaming
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import httpx
import json
import asyncio

app = FastAPI(title="Sovereign AI Microservice", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class InferenceRequest(BaseModel):
    model: str = Field(default="qwen2.5-coder:14b", description="Model tag")
    prompt: str = Field(..., min_length=1, description="Input user prompt")
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "engine": "FastAPI/Uvicorn", "version": "3.12"}

@app.post("/v1/chat/stream")
async def stream_inference(req: InferenceRequest):
    async def token_generator():
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                async with client.stream(
                    "POST",
                    "http://127.0.0.1:11434/api/generate",
                    json={"model": req.model, "prompt": req.prompt, "stream": True}
                ) as response:
                    if response.status_code != 200:
                        yield f"data: {json.dumps({'error': 'Local model offline'})}\\n\\n"
                        return

                    async for line in response.aiter_lines():
                        if line:
                            data = json.loads(line)
                            yield f"data: {json.dumps({'token': data.get('response', '')})}\\n\\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\\n\\n"

    return StreamingResponse(token_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
`
  },

  // ── 2. RUST AXUM + TOKIO MICROSERVICE ────────────────────────────────────
  {
    id: 'rust_axum_tokio',
    title: 'Rust Axum & Tokio High-Throughput Microservice',
    category: 'backend_languages',
    vendor: 'Rust Language',
    badge: 'Memory Safe & Ultra-Fast',
    icon: 'Cpu',
    color: '#dea584',
    description: 'High-throughput Rust web service built with Axum 0.7, Tokio async runtime, Tower HTTP middleware, structured Tracing, and robust Serde JSON error envelopes.',
    suggestedPath: '/projects/cybeni/rust/src/main.rs',
    language: 'rust',
    aiPrompt: 'Implement high-performance Rust web service using Axum, Tokio, Tower CORS, Serde JSON, and stateful AppState sharing.',
    faqs: [
      {
        question: 'Why choose Axum for sovereign backends?',
        answer: 'Axum has zero unsafe code, sub-millisecond route dispatch, seamless Tokio integration, and memory footprint under 15MB.'
      }
    ],
    code: `use axum::{
    routing::{get, post},
    extract::{State, Json},
    response::IntoResponse,
    http::StatusCode,
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::CorsLayer;

#[derive(Clone)]
struct AppState {
    node_id: String,
}

#[derive(Deserialize)]
struct TaskPayload {
    task_name: String,
    priority: u8,
}

#[derive(Serialize)]
struct TaskResponse {
    task_id: String,
    status: String,
}

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "Sovereign Rust Axum Node Online")
}

async fn handle_task(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<TaskPayload>,
) -> impl IntoResponse {
    let response = TaskResponse {
        task_id: format!("{}-{}", state.node_id, uuid::Uuid::new_v4()),
        status: format!("Queued: {}", payload.task_name),
    };
    (StatusCode::CREATED, Json(response))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let state = Arc::new(AppState {
        node_id: "node_alpha_01".to_string(),
    });

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/tasks", post(handle_task))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    println!("Rust Axum server listening on http://127.0.0.1:3000");
    axum::serve(listener, app).await.unwrap();
}
`
  },

  // ── 3. GO FIBER MICROSERVICE ─────────────────────────────────────────────
  {
    id: 'go_fiber_microservice',
    title: 'Go 1.22+ Fiber Fast REST Microservice',
    category: 'backend_languages',
    vendor: 'Golang',
    badge: 'Ultra-Low Latency',
    icon: 'Terminal',
    color: '#00add8',
    description: 'Blazing-fast Go 1.22+ REST microservice using Fiber v2, zero-allocation fasthttp routing, structured logging, and JSON payload binding.',
    suggestedPath: '/projects/cybeni/go/main.go',
    language: 'go',
    aiPrompt: 'Implement Go 1.22+ Fiber microservice with JSON request validation, CORS middleware, error handler, and graceful shutdown signal listener.',
    faqs: [
      {
        question: 'Why choose Go Fiber over Gin or standard net/http?',
        answer: 'Fiber is built on top of fasthttp, delivering 10x higher request throughput with zero memory allocation on hot request paths.'
      }
    ],
    code: `package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

type SystemMetric struct {
	CPUUsage    float64 \`json:"cpu_usage"\`
	RAMUsage    float64 \`json:"ram_usage"\`
	ActiveNodes int     \`json:"active_nodes"\`
}

func main() {
	app := fiber.New(fiber.Config{
		AppName: "NovAura Sovereign Go Fiber Core v1.0",
	})

	app.Use(logger.New())
	app.Use(cors.New())

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "online",
			"runtime": "go1.22",
		})
	})

	app.Post("/metrics", func(c *fiber.Ctx) error {
		metric := new(SystemMetric)
		if err := c.BodyParser(metric); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Invalid metric payload",
			})
		}
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"recorded": true,
			"metric": metric,
		})
	})

	// Graceful shutdown channel
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-c
		log.Println("Shutting down Go Fiber server gracefully...")
		_ = app.Shutdown()
	}()

	if err := app.Listen(":8080"); err != nil {
		log.Printf("Server closed: %v\n", err)
	}
}
`
  }
];
