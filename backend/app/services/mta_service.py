from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from google.transit import gtfs_realtime_pb2

from app.services.station_service import get_station_name


MTA_FEED_URLS = {
    "1234567": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs"
    ),
    "ACE": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace"
    ),
    "BDFM": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm"
    ),
    "G": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g"
    ),
    "JZ": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz"
    ),
    "L": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l"
    ),
    "NQRW": (
        "https://api-endpoint.mta.info/"
        "Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw"
    ),
}

NY_TIMEZONE = ZoneInfo("America/New_York")


def fetch_feed(url: str):
    response = requests.get(
        url,
        timeout=15,
    )

    response.raise_for_status()

    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(
        response.content
    )

    return feed


def get_subway_feed():
    return fetch_feed(
        MTA_FEED_URLS["1234567"]
    )


def get_subway_feeds():
    feeds = []

    for feed_name, url in (
        MTA_FEED_URLS.items()
    ):
        try:
            feed = fetch_feed(url)

            feeds.append(
                {
                    "name": feed_name,
                    "feed": feed,
                }
            )

        except Exception as exc:
            print(
                f"Could not fetch MTA feed "
                f"{feed_name}: {exc}"
            )

    return feeds


def get_direction(stop_id: str):
    if stop_id.endswith("N"):
        return "Northbound"

    if stop_id.endswith("S"):
        return "Southbound"

    return "Unknown"


def format_arrival_time(
    timestamp: int
):
    return datetime.fromtimestamp(
        timestamp,
        tz=NY_TIMEZONE,
    )


def matches_station(
    arrival_station_name: str,
    requested_station: str | None,
):
    if not requested_station:
        return True

    return (
        arrival_station_name
        .strip()
        .lower()
        ==
        requested_station
        .strip()
        .lower()
    )


def matches_route(
    arrival_route_id: str,
    requested_route_id: str | None,
):
    if not requested_route_id:
        return True

    return (
        arrival_route_id
        .strip()
        .upper()
        ==
        requested_route_id
        .strip()
        .upper()
    )


def get_train_arrivals(
    limit: int = 20,
    station: str | None = None,
    route_id: str | None = None,
):
    feeds = get_subway_feeds()

    arrivals = []

    now = datetime.now(
        NY_TIMEZONE
    )

    for feed_data in feeds:
        feed = feed_data["feed"]

        for entity in feed.entity:
            if not entity.HasField(
                "trip_update"
            ):
                continue

            trip_update = (
                entity.trip_update
            )

            trip = trip_update.trip

            current_route_id = (
                trip.route_id
            )

            trip_id = (
                trip.trip_id
            )

            if not matches_route(
                current_route_id,
                route_id,
            ):
                continue

            for stop_update in (
                trip_update
                .stop_time_update
            ):
                if not (
                    stop_update.HasField(
                        "arrival"
                    )
                ):
                    continue

                arrival_timestamp = (
                    stop_update
                    .arrival
                    .time
                )

                if (
                    arrival_timestamp <= 0
                ):
                    continue

                arrival_datetime = (
                    format_arrival_time(
                        arrival_timestamp
                    )
                )

                seconds_away = (
                    arrival_datetime
                    - now
                ).total_seconds()

                if seconds_away < 0:
                    continue

                minutes_away = int(
                    seconds_away / 60
                )

                stop_id = (
                    stop_update.stop_id
                )

                station_name = (
                    get_station_name(
                        stop_id
                    )
                )

                if not matches_station(
                    station_name,
                    station,
                ):
                    continue

                arrivals.append(
                    {
                        "route_id":
                            current_route_id,
                        "trip_id":
                            trip_id,
                        "stop_id":
                            stop_id,
                        "station_name":
                            station_name,
                        "direction":
                            get_direction(
                                stop_id
                            ),
                        "arrival_time":
                            arrival_datetime
                            .isoformat(),
                        "minutes_away":
                            minutes_away,
                    }
                )

    arrivals.sort(
        key=lambda arrival:
            arrival[
                "arrival_time"
            ]
    )

    return arrivals[:limit]


def get_translation_text(
    translated_string
):
    for translation in (
        translated_string.translation
    ):
        if (
            translation.language
            .lower()
            == "en"
        ):
            return translation.text

    if (
        translated_string.translation
    ):
        return (
            translated_string
            .translation[0]
            .text
        )

    return ""


def get_alert_routes(alert):
    routes = set()

    for informed_entity in (
        alert.informed_entity
    ):
        route_id = (
            informed_entity.route_id
        )

        if route_id:
            routes.add(
                route_id
            )

        if (
            informed_entity
            .HasField("trip")
        ):
            trip_route_id = (
                informed_entity
                .trip
                .route_id
            )

            if trip_route_id:
                routes.add(
                    trip_route_id
                )

    return sorted(routes)


def get_alert_stops(alert):
    stops = []

    seen = set()

    for informed_entity in (
        alert.informed_entity
    ):
        stop_id = (
            informed_entity.stop_id
        )

        if not stop_id:
            continue

        base_stop_id = stop_id

        if stop_id.endswith(
            ("N", "S")
        ):
            base_stop_id = (
                stop_id[:-1]
            )

        if base_stop_id in seen:
            continue

        seen.add(
            base_stop_id
        )

        stops.append(
            {
                "stop_id":
                    base_stop_id,
                "station_name":
                    get_station_name(
                        base_stop_id
                    ),
            }
        )

    return stops


def get_active_periods(alert):
    periods = []

    for period in (
        alert.active_period
    ):
        start = None
        end = None

        if period.start:
            start = (
                datetime.fromtimestamp(
                    period.start,
                    tz=NY_TIMEZONE,
                ).isoformat()
            )

        if period.end:
            end = (
                datetime.fromtimestamp(
                    period.end,
                    tz=NY_TIMEZONE,
                ).isoformat()
            )

        periods.append(
            {
                "start": start,
                "end": end,
            }
        )

    return periods


def get_service_alerts(
    route_id: str | None = None,
):
    feeds = get_subway_feeds()

    alerts = []

    seen_alert_ids = set()

    for feed_data in feeds:
        feed_name = (
            feed_data["name"]
        )

        feed = (
            feed_data["feed"]
        )

        for entity in feed.entity:
            if not entity.HasField(
                "alert"
            ):
                continue

            if (
                entity.id
                in seen_alert_ids
            ):
                continue

            alert = entity.alert

            routes = (
                get_alert_routes(
                    alert
                )
            )

            if (
                route_id
                and route_id.upper()
                not in [
                    route.upper()
                    for route in routes
                ]
            ):
                continue

            header = (
                get_translation_text(
                    alert.header_text
                )
            )

            description = (
                get_translation_text(
                    alert.description_text
                )
            )

            cause_name = (
                gtfs_realtime_pb2
                .Alert
                .Cause
                .Name(
                    alert.cause
                )
            )

            effect_name = (
                gtfs_realtime_pb2
                .Alert
                .Effect
                .Name(
                    alert.effect
                )
            )

            alerts.append(
                {
                    "id":
                        entity.id,
                    "feed":
                        feed_name,
                    "routes":
                        routes,
                    "stations":
                        get_alert_stops(
                            alert
                        ),
                    "header":
                        header,
                    "description":
                        description,
                    "cause":
                        cause_name,
                    "effect":
                        effect_name,
                    "active_periods":
                        get_active_periods(
                            alert
                        ),
                }
            )

            seen_alert_ids.add(
                entity.id
            )

    alerts.sort(
        key=lambda item: (
            item["routes"],
            item["header"],
        )
    )

    return alerts