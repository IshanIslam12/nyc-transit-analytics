import math
import time
from datetime import datetime, timezone

import requests
from google.transit import gtfs_realtime_pb2

from app.services.station_service import get_station_name


# ============================================================
# MTA GTFS-REALTIME FEEDS
# ============================================================

MTA_FEED_URLS = {
    "numbered": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs"
    ),
    "ace": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace"
    ),
    "bdfm": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm"
    ),
    "g": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g"
    ),
    "jz": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz"
    ),
    "l": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l"
    ),
    "nqrw": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw"
    ),
}


# ============================================================
# BASIC HELPERS
# ============================================================

def fetch_feed(url: str):
    """
    Download and parse one MTA GTFS-Realtime feed.
    """

    response = requests.get(
        url,
        timeout=15,
    )

    response.raise_for_status()

    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(response.content)

    return feed


def get_subway_feed(feed_name: str = "numbered"):
    """
    Return one subway GTFS-Realtime feed.
    """

    if feed_name not in MTA_FEED_URLS:
        raise ValueError(
            f"Unknown subway feed: {feed_name}"
        )

    return fetch_feed(
        MTA_FEED_URLS[feed_name]
    )


def get_subway_feeds():
    """
    Fetch every configured subway feed.

    If one feed fails, the remaining feeds are still returned.
    """

    feeds = {}

    for feed_name, url in MTA_FEED_URLS.items():
        try:
            feeds[feed_name] = fetch_feed(url)

        except Exception as exc:
            print(
                f"Failed to fetch MTA feed "
                f"{feed_name}: {exc}"
            )

    return feeds


# ============================================================
# ARRIVAL HELPERS
# ============================================================

def get_direction(stop_id: str) -> str:
    """
    Determine train direction using the stop ID suffix.

    Most NYC Subway realtime stop IDs end in:
    N = northbound
    S = southbound
    """

    if not stop_id:
        return "Unknown"

    stop_id_upper = stop_id.upper()

    if stop_id_upper.endswith("N"):
        return "Northbound"

    if stop_id_upper.endswith("S"):
        return "Southbound"

    return "Unknown"


def get_base_stop_id(stop_id: str) -> str:
    """
    Remove the N/S realtime direction suffix from a stop ID.

    Example:
        127N -> 127
        A27S -> A27
    """

    if not stop_id:
        return stop_id

    if stop_id[-1:].upper() in {"N", "S"}:
        return stop_id[:-1]

    return stop_id


def format_arrival_time(
    timestamp: int,
) -> str:
    """
    Convert a Unix arrival timestamp to an ISO timestamp.
    """

    arrival_datetime = datetime.fromtimestamp(
        timestamp,
        tz=timezone.utc,
    )

    return arrival_datetime.isoformat()


def get_arrival_timestamp(stop_time_update):
    """
    Get the best realtime timestamp available for a stop.

    GTFS-Realtime normally provides arrival.time.
    Some updates may only provide departure.time, so departure
    is used as a fallback.
    """

    if (
        stop_time_update.HasField("arrival")
        and stop_time_update.arrival.time > 0
    ):
        return stop_time_update.arrival.time

    if (
        stop_time_update.HasField("departure")
        and stop_time_update.departure.time > 0
    ):
        return stop_time_update.departure.time

    return None


# ============================================================
# LIVE TRAIN ARRIVALS
# ============================================================

def get_train_arrivals(
    limit: int = 100,
    station: str | None = None,
    route_id: str | None = None,
):
    """
    Return live NYC Subway arrival predictions.

    Each arrival includes a live countdown calculated from the
    MTA GTFS-Realtime Unix timestamp.

    Example:
        arrival timestamp - current timestamp = 336 seconds
        ceil(336 / 60) = 6 minutes
    """

    feeds = get_subway_feeds()

    current_timestamp = int(time.time())

    arrivals = []

    normalized_station = (
        station.strip().lower()
        if station
        else None
    )

    normalized_route = (
        route_id.strip().upper()
        if route_id
        else None
    )

    for feed_name, feed in feeds.items():

        for entity in feed.entity:

            if not entity.HasField("trip_update"):
                continue

            trip_update = entity.trip_update

            trip = trip_update.trip

            trip_route_id = (
                trip.route_id.strip()
                if trip.route_id
                else ""
            )

            trip_id = (
                trip.trip_id.strip()
                if trip.trip_id
                else ""
            )

            if not trip_route_id:
                continue

            # Route filtering
            if normalized_route:
                if (
                    trip_route_id.upper()
                    != normalized_route
                ):
                    continue

            for stop_time_update in (
                trip_update.stop_time_update
            ):

                stop_id = (
                    stop_time_update.stop_id.strip()
                    if stop_time_update.stop_id
                    else ""
                )

                if not stop_id:
                    continue

                arrival_timestamp = (
                    get_arrival_timestamp(
                        stop_time_update
                    )
                )

                if arrival_timestamp is None:
                    continue

                # Ignore trains whose predicted arrival has passed.
                seconds_away = (
                    arrival_timestamp
                    - current_timestamp
                )

                if seconds_away < 0:
                    continue

                # IMPORTANT:
                # ceil gives proper countdown behavior.
                #
                # 361 seconds -> 7 min
                # 330 seconds -> 6 min
                # 125 seconds -> 3 min
                # 61 seconds  -> 2 min
                # 30 seconds  -> 1 min
                minutes_away = max(
                    1,
                    math.ceil(
                        seconds_away / 60
                    ),
                )

                base_stop_id = get_base_stop_id(
                    stop_id
                )

                station_name = get_station_name(
                    base_stop_id
                )

                if not station_name:
                    station_name = stop_id

                # Exact station filtering
                if normalized_station:
                    if (
                        station_name.strip().lower()
                        != normalized_station
                    ):
                        continue

                arrival = {
                    "route_id": trip_route_id,
                    "trip_id": trip_id,
                    "stop_id": stop_id,
                    "station_name": station_name,
                    "direction": get_direction(
                        stop_id
                    ),
                    "arrival_time": (
                        format_arrival_time(
                            arrival_timestamp
                        )
                    ),
                    "arrival_timestamp": (
                        arrival_timestamp
                    ),
                    "seconds_away": seconds_away,
                    "minutes_away": minutes_away,
                    "feed": feed_name,
                }

                arrivals.append(arrival)

    # Nearest trains first.
    arrivals.sort(
        key=lambda item: (
            item["arrival_timestamp"],
            item["route_id"],
            item["station_name"],
        )
    )

    return arrivals[:limit]


# ============================================================
# SERVICE ALERT HELPERS
# ============================================================

def get_translated_text(
    translated_string,
) -> str:
    """
    Extract English text from a GTFS translated string.

    Falls back to the first available translation.
    """

    if not translated_string:
        return ""

    fallback = ""

    for translation in (
        translated_string.translation
    ):

        text = translation.text.strip()

        if not text:
            continue

        if not fallback:
            fallback = text

        language = (
            translation.language.lower()
            if translation.language
            else ""
        )

        if language.startswith("en"):
            return text

    return fallback


def get_alert_routes(alert):
    """
    Extract subway route IDs referenced by an alert.
    """

    routes = set()

    for informed_entity in (
        alert.informed_entity
    ):

        route = (
            informed_entity.route_id.strip()
            if informed_entity.route_id
            else ""
        )

        if route:
            routes.add(route)

    return sorted(routes)


def get_alert_stops(alert):
    """
    Extract stop IDs referenced by an alert.
    """

    stops = set()

    for informed_entity in (
        alert.informed_entity
    ):

        stop = (
            informed_entity.stop_id.strip()
            if informed_entity.stop_id
            else ""
        )

        if stop:
            stops.add(stop)

    return sorted(stops)


def get_alert_effect(alert) -> str:
    """
    Convert GTFS alert effect enum into a readable string.
    """

    try:
        effect_name = (
            gtfs_realtime_pb2.Alert.Effect.Name(
                alert.effect
            )
        )

        return effect_name.replace(
            "_",
            " ",
        ).title()

    except Exception:
        return "Service Alert"


def get_active_periods(alert):
    """
    Convert GTFS alert active periods to JSON-safe data.
    """

    periods = []

    for period in alert.active_period:

        start = (
            period.start
            if period.HasField("start")
            else None
        )

        end = (
            period.end
            if period.HasField("end")
            else None
        )

        periods.append(
            {
                "start": start,
                "end": end,
            }
        )

    return periods


# ============================================================
# SERVICE ALERTS
# ============================================================

def get_service_alerts(
    route_id: str | None = None,
):
    """
    Return active MTA subway service alerts.

    A route may optionally be supplied to filter alerts.
    """

    feeds = get_subway_feeds()

    alerts = []

    normalized_route = (
        route_id.strip().upper()
        if route_id
        else None
    )

    seen_alert_ids = set()

    for feed_name, feed in feeds.items():

        for entity in feed.entity:

            if not entity.HasField("alert"):
                continue

            alert = entity.alert

            alert_id = (
                entity.id
                if entity.id
                else (
                    f"{feed_name}-"
                    f"{len(alerts)}"
                )
            )

            # Avoid duplicate alert entities that can appear
            # across feeds.
            if alert_id in seen_alert_ids:
                continue

            routes = get_alert_routes(alert)

            if normalized_route:
                route_matches = any(
                    route.upper()
                    == normalized_route
                    for route in routes
                )

                if not route_matches:
                    continue

            stops = get_alert_stops(alert)

            header = get_translated_text(
                alert.header_text
            )

            description = get_translated_text(
                alert.description_text
            )

            effect = get_alert_effect(alert)

            alerts.append(
                {
                    "id": alert_id,
                    "routes": routes,
                    "stops": stops,
                    "effect": effect,
                    "header": (
                        header
                        or "MTA Service Alert"
                    ),
                    "description": description,
                    "active_periods": (
                        get_active_periods(alert)
                    ),
                    "feed": feed_name,
                }
            )

            seen_alert_ids.add(alert_id)

    return alerts