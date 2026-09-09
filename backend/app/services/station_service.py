import csv
from pathlib import Path


STOPS_FILE = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "gtfs"
    / "stops.txt"
)


def load_stations():
    stations = {}

    if not STOPS_FILE.exists():
        raise FileNotFoundError(
            f"Could not find MTA stops file: {STOPS_FILE}"
        )

    with open(
        STOPS_FILE,
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:
        reader = csv.DictReader(file)

        for row in reader:
            stop_id = row["stop_id"]
            stop_name = row["stop_name"]

            stations[stop_id] = stop_name

    return stations


STATIONS = load_stations()


def get_station_name(stop_id: str):
    base_stop_id = stop_id

    if stop_id.endswith(("N", "S")):
        base_stop_id = stop_id[:-1]

    return (
        STATIONS.get(stop_id)
        or STATIONS.get(base_stop_id)
        or "Unknown Station"
    )


def get_all_stations():
    stations = []

    if not STOPS_FILE.exists():
        raise FileNotFoundError(
            f"Could not find MTA stops file: {STOPS_FILE}"
        )

    with open(
        STOPS_FILE,
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as file:
        reader = csv.DictReader(file)

        for row in reader:
            if row["location_type"] != "1":
                continue

            stations.append(
                {
                    "stop_id": row["stop_id"],
                    "station_name": row["stop_name"],
                    "latitude": float(
                        row["stop_lat"]
                    ),
                    "longitude": float(
                        row["stop_lon"]
                    ),
                }
            )

    stations.sort(
        key=lambda station: station["station_name"]
    )

    return stations