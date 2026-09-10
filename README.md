# NYC Real-Time Transit Analytics Platform

A full-stack data engineering and analytics platform that collects, stores, analyzes, and visualizes real-time New York City subway data.

The platform consumes MTA GTFS-Realtime feeds, processes live train arrival and service alert data through a FastAPI backend, stores historical observations in PostgreSQL, and presents real-time and historical transit analytics through an interactive React dashboard.

## Features

- Real-time NYC subway arrival tracking
- Search and filter by subway station and route
- Interactive NYC subway station map
- Live MTA service alerts
- Automatic GTFS-Realtime data collection
- Historical arrival prediction storage
- Route reliability and prediction stability analytics
- Historical reliability trend visualization
- PostgreSQL-backed analytics
- REST API built with FastAPI
- Interactive React + TypeScript dashboard
- Dockerized frontend, backend, database, and data collector
- Automated backend API testing with Pytest

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Recharts
- Leaflet
- React-Leaflet
- OpenStreetMap

### Backend

- Python
- FastAPI
- SQLAlchemy
- Pydantic
- Uvicorn

### Data & Analytics

- PostgreSQL
- MTA GTFS-Realtime
- MTA Static GTFS
- Protocol Buffers
- Historical time-series analysis

### Infrastructure & Testing

- Docker
- Docker Compose
- Pytest
- Git
- GitHub

## Architecture

```text
                    MTA GTFS-Realtime
                           │
                           ▼
                  ┌─────────────────┐
                  │  Data Collector │
                  │     Python      │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   PostgreSQL    │
                  │ Historical Data │
                  └────────┬────────┘
                           │
                           ▼
┌────────────────┐   ┌─────────────────┐
│ MTA Static GTFS│──▶│ FastAPI Backend │
│ Station Data   │   │   REST API      │
└────────────────┘   └────────┬────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │ React Dashboard │
                     │   TypeScript    │
                     └─────────────────┘
```

The application runs as four Docker services:

```text
frontend
   │
   ▼
backend
   │
   ├──────────────► MTA GTFS-Realtime
   │
   ▼
PostgreSQL ◄──── collector
```

## How It Works

### 1. Real-Time Data Collection

The backend retrieves live subway information from multiple MTA GTFS-Realtime feeds covering the main NYC subway route groups.

GTFS-Realtime Protocol Buffer messages are parsed into structured arrival information including:

- Route
- Trip
- Station
- Direction
- Predicted arrival time
- Seconds until arrival
- Minutes until arrival

### 2. Station Data

Static MTA GTFS data is used to map stop IDs to human-readable station information and geographic coordinates.

The application loads approximately 500 subway stations that can be searched or selected directly from the interactive map.

### 3. Historical Storage

A background collector periodically captures live arrival predictions and stores them in PostgreSQL.

Each observation contains information such as:

```text
route_id
trip_id
stop_id
station_name
direction
arrival_time
recorded_at
```

This transforms the live MTA feed into a historical dataset that can be analyzed over time.

### 4. Transit Analytics

Historical observations are used to calculate metrics including:

- Route prediction changes
- Prediction stability
- Percentage of delayed predictions
- Average prediction change
- Route-level reliability trends
- Station and route observation counts

In this project, **reliability represents the stability of MTA arrival predictions over time**, rather than official schedule adherence.

### 5. Interactive Dashboard

The React dashboard allows users to:

- Search NYC subway stations
- Select subway routes
- View upcoming arrivals
- Monitor arrival countdowns
- View active service alerts
- Explore subway stations on an interactive map
- Analyze prediction delay rates
- View historical prediction stability

## API Endpoints

FastAPI automatically generates interactive API documentation at:

```text
http://localhost:8000/docs
```

Key endpoints include:

| Endpoint | Description |
| --- | --- |
| `GET /api/transit/feed` | Retrieve live GTFS-Realtime feed information |
| `GET /api/transit/arrivals` | Retrieve upcoming subway arrivals |
| `GET /api/transit/alerts` | Retrieve active MTA service alerts |
| `GET /api/transit/stations` | Retrieve subway stations and coordinates |
| `POST /api/transit/collect` | Store a snapshot of current arrival predictions |
| `GET /api/analytics/route-counts` | Observation counts by route |
| `GET /api/analytics/station-counts` | Observation counts by station |
| `GET /api/analytics/average-wait-times` | Analyze predicted arrival horizons |
| `GET /api/analytics/prediction-changes` | Analyze changes in arrival predictions |
| `GET /api/analytics/route-reliability` | Route-level prediction stability metrics |
| `GET /api/analytics/reliability-history` | Historical prediction stability |

## Running the Project

### Prerequisites

Install:

- Docker
- Docker Compose
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/nyc-transit-analytics.git
cd nyc-transit-analytics
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then configure the PostgreSQL credentials if necessary.

Example:

```env
POSTGRES_USER=transit_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=transit_db

DATABASE_URL=postgresql://transit_user:your_password@db:5432/transit_db
```

### 3. Start the Application

```bash
docker compose up --build
```

Or run it in the background:

```bash
docker compose up -d --build
```

Docker Compose starts:

- PostgreSQL database
- FastAPI backend
- Background data collector
- React frontend

### 4. Open the Dashboard

```text
http://localhost:5173
```

FastAPI documentation:

```text
http://localhost:8000/docs
```

### 5. Stop the Application

```bash
docker compose down
```

## Testing

Backend API tests are implemented using Pytest.

Run the test suite from the backend directory:

```bash
pytest -v
```

Current test suite:

```text
10 passed
```

Tests cover major API functionality including transit data and analytics endpoints.

## Project Structure

```text
nyc-transit-analytics/
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   │   ├── transit.py
│   │   │   └── analytics.py
│   │   ├── services/
│   │   │   ├── mta_service.py
│   │   │   ├── station_service.py
│   │   │   └── storage_service.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── main.py
│   │
│   ├── tests/
│   │   └── test_api.py
│   │
│   ├── collector.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── data/
│   └── gtfs/
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   └── App.css
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

## Database

Historical transit observations are stored in PostgreSQL.

The main observation table records:

| Field | Description |
| --- | --- |
| `id` | Unique observation identifier |
| `route_id` | Subway route |
| `trip_id` | MTA trip identifier |
| `stop_id` | GTFS stop identifier |
| `station_name` | Human-readable station name |
| `direction` | Train direction |
| `arrival_time` | Predicted train arrival |
| `recorded_at` | Time the prediction was collected |

Because predictions are collected repeatedly, the database can track how an individual train's predicted arrival changes over time.

## Reliability Analysis

Instead of simply displaying current train locations, the platform builds historical prediction data.

For the same train and station, consecutive predictions can be compared:

```text
Prediction 1: Train arrives at 8:15 PM
Prediction 2: Train arrives at 8:17 PM
Prediction 3: Train arrives at 8:19 PM
```

The changing prediction provides a way to quantify **prediction volatility**.

Smaller changes indicate more stable predictions, while larger or repeated changes indicate less reliable arrival estimates.

This enables route-level and historical reliability analysis from data that would otherwise disappear from the live feed.

## Future Improvements

Potential extensions include:

- Schedule-vs-realtime delay analysis
- SQL-based analytics optimization
- Database retention policies
- Additional historical trend analysis
- Route and station comparison tools
- Frontend automated testing
- CI/CD with GitHub Actions
- Cloud deployment
- Additional transit performance metrics

## Data Source

Transit information is provided by the Metropolitan Transportation Authority (MTA) through its public GTFS and GTFS-Realtime data feeds.

This project is independently developed and is not affiliated with or endorsed by the MTA.

## Author

**Ishan Islam**

Computer Science graduate and M.S. Analytics student interested in software engineering, data engineering, machine learning, and analytics.