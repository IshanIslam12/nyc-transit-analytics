import time
from datetime import datetime

from app.services.storage_service import save_current_arrivals


COLLECTION_INTERVAL_SECONDS = 60
ARRIVAL_LIMIT = 500


def run_collector():
    print("NYC Transit data collector started.")
    print(
        f"Collecting up to {ARRIVAL_LIMIT} arrivals "
        f"every {COLLECTION_INTERVAL_SECONDS} seconds."
    )

    while True:
        try:
            saved_count = save_current_arrivals(
                ARRIVAL_LIMIT
            )

            print(
                f"[{datetime.now()}] "
                f"Saved {saved_count} observations."
            )

        except Exception as exc:
            print(
                f"[{datetime.now()}] "
                f"Collection failed: {exc}"
            )

        time.sleep(
            COLLECTION_INTERVAL_SECONDS
        )


if __name__ == "__main__":
    run_collector()