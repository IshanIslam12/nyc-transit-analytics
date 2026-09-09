from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database import Base


class TransitObservation(Base):
    __tablename__ = "transit_observations"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    route_id = Column(
        String(10),
        nullable=False,
        index=True
    )

    trip_id = Column(
        String(100),
        nullable=False,
        index=True
    )

    stop_id = Column(
        String(50),
        nullable=False,
        index=True
    )

    station_name = Column(
        String(150),
        nullable=False,
        index=True
    )

    direction = Column(
        String(20),
        nullable=False
    )

    arrival_time = Column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )

    recorded_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )