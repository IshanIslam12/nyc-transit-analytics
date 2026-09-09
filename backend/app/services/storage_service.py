from datetime import datetime

from app.database import SessionLocal
from app.models import TransitObservation
from app.services.mta_service import get_train_arrivals


def save_current_arrivals(limit=100):
    arrivals = get_train_arrivals(limit)

    db = SessionLocal()

    saved_count = 0

    try:
        for arrival in arrivals:
            observation = TransitObservation(
                route_id=arrival["route_id"],
                trip_id=arrival["trip_id"],
                stop_id=arrival["stop_id"],
                station_name=arrival["station_name"],
                direction=arrival["direction"],
                arrival_time=datetime.fromisoformat(
                    arrival["arrival_time"]
                )
            )

            db.add(observation)
            saved_count += 1

        db.commit()

        return saved_count

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()