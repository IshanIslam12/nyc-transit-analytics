from fastapi import (
    APIRouter,
    HTTPException,
)

from app.services.mta_service import (
    get_subway_feeds,
    get_train_arrivals,
    get_service_alerts,
)
from app.services.storage_service import (
    save_current_arrivals,
)
from app.services.station_service import (
    get_all_stations,
)


router = APIRouter(
    prefix="/api/transit",
    tags=["Transit"],
)


@router.get("/feed")
def get_feed():
    try:
        feeds = (
            get_subway_feeds()
        )

        feed_results = []

        total_entities = 0

        for feed_data in feeds:
            feed = (
                feed_data["feed"]
            )

            entity_count = len(
                feed.entity
            )

            total_entities += (
                entity_count
            )

            feed_results.append(
                {
                    "feed":
                        feed_data[
                            "name"
                        ],
                    "timestamp":
                        feed.header
                        .timestamp,
                    "entity_count":
                        entity_count,
                }
            )

        return {
            "feed_count":
                len(feed_results),
            "total_entities":
                total_entities,
            "feeds":
                feed_results,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


@router.get("/arrivals")
def arrivals(
    limit: int = 20,
    station: str | None = None,
    route_id: str | None = None,
):
    try:
        if limit < 1:
            limit = 1

        if limit > 500:
            limit = 500

        arrival_data = (
            get_train_arrivals(
                limit=limit,
                station=station,
                route_id=route_id,
            )
        )

        return {
            "count":
                len(arrival_data),
            "filters": {
                "station":
                    station,
                "route_id":
                    route_id,
            },
            "arrivals":
                arrival_data,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


@router.get("/alerts")
def alerts(
    route_id: str | None = None,
):
    try:
        alert_data = (
            get_service_alerts(
                route_id=route_id
            )
        )

        return {
            "count":
                len(alert_data),
            "route_id":
                route_id,
            "alerts":
                alert_data,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


@router.post("/collect")
def collect_arrivals(
    limit: int = 500,
):
    try:
        if limit < 1:
            limit = 1

        if limit > 1000:
            limit = 1000

        saved_count = (
            save_current_arrivals(
                limit
            )
        )

        return {
            "status":
                "success",
            "saved":
                saved_count,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


@router.get("/stations")
def stations():
    try:
        station_data = (
            get_all_stations()
        )

        return {
            "count":
                len(station_data),
            "stations":
                station_data,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )