from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TransitObservation


router = APIRouter(
    prefix="/api/analytics",
    tags=["Analytics"]
)


@router.get("/route-counts")
def get_route_counts(
    db: Session = Depends(get_db)
):
    results = (
        db.query(
            TransitObservation.route_id,
            func.count(
                TransitObservation.id
            ).label(
                "observation_count"
            )
        )
        .group_by(
            TransitObservation.route_id
        )
        .order_by(
            func.count(
                TransitObservation.id
            ).desc()
        )
        .all()
    )

    return {
        "routes": [
            {
                "route_id": route_id,
                "observation_count": count,
            }
            for route_id, count in results
        ]
    }


@router.get("/station-counts")
def get_station_counts(
    db: Session = Depends(get_db)
):
    results = (
        db.query(
            TransitObservation.station_name,
            func.count(
                TransitObservation.id
            ).label(
                "observation_count"
            )
        )
        .group_by(
            TransitObservation.station_name
        )
        .order_by(
            func.count(
                TransitObservation.id
            ).desc()
        )
        .all()
    )

    return {
        "stations": [
            {
                "station_name": station_name,
                "observation_count": count,
            }
            for station_name, count in results
        ]
    }


@router.get("/route/{route_id}")
def get_route_analytics(
    route_id: str,
    db: Session = Depends(get_db)
):
    observations = (
        db.query(
            TransitObservation
        )
        .filter(
            TransitObservation.route_id
            == route_id
        )
        .all()
    )

    if not observations:
        return {
            "route_id": route_id,
            "observation_count": 0,
            "station_count": 0,
            "stations": [],
            "latest_arrival": None,
        }

    stations = sorted(
        {
            observation.station_name
            for observation in observations
        }
    )

    latest_arrival = max(
        observation.arrival_time
        for observation in observations
    )

    return {
        "route_id": route_id,
        "observation_count":
            len(observations),
        "station_count":
            len(stations),
        "stations":
            stations,
        "latest_arrival":
            latest_arrival,
    }


@router.get("/average-wait-times")
def get_average_wait_times(
    db: Session = Depends(get_db)
):
    observations = (
        db.query(
            TransitObservation
        )
        .all()
    )

    route_waits = {}

    for observation in observations:
        if observation.arrival_time is None:
            continue

        if observation.recorded_at is None:
            continue

        recorded_at = (
            observation.recorded_at
        )

        arrival_time = (
            observation.arrival_time
        )

        if arrival_time.tzinfo is None:
            arrival_time = (
                arrival_time.replace(
                    tzinfo=timezone.utc
                )
            )

        if recorded_at.tzinfo is None:
            recorded_at = (
                recorded_at.replace(
                    tzinfo=timezone.utc
                )
            )

        wait_seconds = (
            arrival_time
            - recorded_at
        ).total_seconds()

        if wait_seconds < 0:
            continue

        wait_minutes = (
            wait_seconds / 60
        )

        route_id = (
            observation.route_id
        )

        if route_id not in route_waits:
            route_waits[route_id] = []

        route_waits[
            route_id
        ].append(
            wait_minutes
        )

    results = []

    for route_id, waits in (
        route_waits.items()
    ):
        if not waits:
            continue

        average_wait = (
            sum(waits) / len(waits)
        )

        results.append(
            {
                "route_id":
                    route_id,
                "average_wait_minutes":
                    round(
                        average_wait,
                        2,
                    ),
                "observation_count":
                    len(waits),
            }
        )

    results.sort(
        key=lambda item:
            item[
                "average_wait_minutes"
            ]
    )

    return {
        "routes": results
    }


@router.get("/prediction-changes")
def get_prediction_changes(
    db: Session = Depends(get_db)
):
    observations = (
        db.query(
            TransitObservation
        )
        .order_by(
            TransitObservation.trip_id,
            TransitObservation.stop_id,
            TransitObservation.recorded_at,
        )
        .all()
    )

    grouped = {}

    for observation in observations:
        key = (
            observation.trip_id,
            observation.stop_id,
        )

        if key not in grouped:
            grouped[key] = []

        grouped[key].append(
            observation
        )

    results = []

    for (
        trip_id,
        stop_id,
    ), items in grouped.items():

        if len(items) < 2:
            continue

        first = items[0]
        latest = items[-1]

        prediction_change_seconds = (
            latest.arrival_time
            - first.arrival_time
        ).total_seconds()

        prediction_change_minutes = (
            prediction_change_seconds
            / 60
        )

        results.append(
            {
                "route_id":
                    latest.route_id,
                "trip_id":
                    trip_id,
                "stop_id":
                    stop_id,
                "station_name":
                    latest.station_name,
                "direction":
                    latest.direction,
                "first_prediction":
                    first.arrival_time,
                "latest_prediction":
                    latest.arrival_time,
                "prediction_change_minutes":
                    round(
                        prediction_change_minutes,
                        2,
                    ),
            }
        )

    results.sort(
        key=lambda item:
            item[
                "prediction_change_minutes"
            ],
        reverse=True,
    )

    return {
        "count": len(results),
        "prediction_changes":
            results[:100],
    }


@router.get("/route-reliability")
def get_route_reliability(
    db: Session = Depends(get_db)
):
    observations = (
        db.query(
            TransitObservation
        )
        .order_by(
            TransitObservation.trip_id,
            TransitObservation.stop_id,
            TransitObservation.recorded_at,
        )
        .all()
    )

    grouped_predictions = {}

    for observation in observations:
        key = (
            observation.trip_id,
            observation.stop_id,
        )

        if key not in grouped_predictions:
            grouped_predictions[key] = []

        grouped_predictions[
            key
        ].append(
            observation
        )

    route_changes = {}

    for items in (
        grouped_predictions.values()
    ):
        if len(items) < 2:
            continue

        first = items[0]
        latest = items[-1]

        change_minutes = (
            (
                latest.arrival_time
                - first.arrival_time
            ).total_seconds()
            / 60
        )

        route_id = latest.route_id

        if route_id not in route_changes:
            route_changes[
                route_id
            ] = []

        route_changes[
            route_id
        ].append(
            change_minutes
        )

    results = []

    for (
        route_id,
        changes,
    ) in route_changes.items():

        if not changes:
            continue

        average_change = (
            sum(changes)
            / len(changes)
        )

        delayed_predictions = sum(
            1
            for change in changes
            if change > 1
        )

        delayed_percentage = (
            delayed_predictions
            / len(changes)
        ) * 100

        results.append(
            {
                "route_id":
                    route_id,
                "average_prediction_change_minutes":
                    round(
                        average_change,
                        2,
                    ),
                "delayed_prediction_percentage":
                    round(
                        delayed_percentage,
                        2,
                    ),
                "samples":
                    len(changes),
            }
        )

    results.sort(
        key=lambda item:
            item[
                "average_prediction_change_minutes"
            ],
        reverse=True,
    )

    return {
        "routes": results
    }


@router.get("/reliability-history")
def get_reliability_history(
    route_id: str | None = None,
    hours: int = 6,
    db: Session = Depends(get_db),
):
    if hours < 1:
        hours = 1

    if hours > 48:
        hours = 48

    cutoff = (
        datetime.now(timezone.utc)
        - timedelta(hours=hours)
    )

    query = (
        db.query(
            TransitObservation
        )
        .filter(
            TransitObservation.recorded_at
            >= cutoff
        )
    )

    if route_id:
        query = query.filter(
            TransitObservation.route_id
            == route_id
        )

    observations = (
        query
        .order_by(
            TransitObservation.trip_id,
            TransitObservation.stop_id,
            TransitObservation.recorded_at,
        )
        .all()
    )

    grouped_predictions = defaultdict(
        list
    )

    for observation in observations:
        key = (
            observation.trip_id,
            observation.stop_id,
        )

        grouped_predictions[
            key
        ].append(
            observation
        )

    time_buckets = defaultdict(
        list
    )

    for items in (
        grouped_predictions.values()
    ):
        if len(items) < 2:
            continue

        previous = items[0]

        for current in items[1:]:
            prediction_change = (
                current.arrival_time
                - previous.arrival_time
            ).total_seconds() / 60

            absolute_change = abs(
                prediction_change
            )

            recorded_at = (
                current.recorded_at
            )

            if recorded_at.tzinfo is None:
                recorded_at = (
                    recorded_at.replace(
                        tzinfo=timezone.utc
                    )
                )

            bucket_minute = (
                recorded_at.minute
                // 5
                * 5
            )

            bucket = (
                recorded_at.replace(
                    minute=bucket_minute,
                    second=0,
                    microsecond=0,
                )
            )

            time_buckets[
                bucket
            ].append(
                absolute_change
            )

            previous = current

    results = []

    for timestamp in sorted(
        time_buckets.keys()
    ):
        changes = (
            time_buckets[
                timestamp
            ]
        )

        if not changes:
            continue

        average_change = (
            sum(changes)
            / len(changes)
        )

        results.append(
            {
                "timestamp":
                    timestamp,
                "average_prediction_change_minutes":
                    round(
                        average_change,
                        2,
                    ),
                "samples":
                    len(changes),
            }
        )

    return {
        "route_id": route_id,
        "hours": hours,
        "points": results,
    }