from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_root():
    response = client.get("/")

    assert response.status_code == 200


def test_health():
    response = client.get("/health")

    assert response.status_code == 200

    data = response.json()

    assert "status" in data


def test_stations():
    response = client.get(
        "/api/transit/stations"
    )

    assert response.status_code == 200

    data = response.json()

    assert "count" in data
    assert "stations" in data
    assert isinstance(
        data["stations"],
        list
    )


def test_arrivals():
    response = client.get(
        "/api/transit/arrivals?limit=5"
    )

    assert response.status_code == 200

    data = response.json()

    assert "count" in data
    assert "arrivals" in data
    assert isinstance(
        data["arrivals"],
        list
    )

    assert len(
        data["arrivals"]
    ) <= 5


def test_route_reliability():
    response = client.get(
        "/api/analytics/route-reliability"
    )

    assert response.status_code == 200

    data = response.json()

    assert "routes" in data
    assert isinstance(
        data["routes"],
        list
    )


def test_reliability_history():
    response = client.get(
        "/api/analytics/reliability-history?hours=6"
    )

    assert response.status_code == 200

    data = response.json()

    assert "hours" in data
    assert "points" in data
    assert data["hours"] == 6
    assert isinstance(
        data["points"],
        list
    )


def test_alerts():
    response = client.get(
        "/api/transit/alerts"
    )

    assert response.status_code == 200

    data = response.json()

    assert "count" in data
    assert "alerts" in data
    assert isinstance(
        data["alerts"],
        list
    )


def test_arrival_limit():
    response = client.get(
        "/api/transit/arrivals?limit=1"
    )

    assert response.status_code == 200

    data = response.json()

    assert len(
        data["arrivals"]
    ) <= 1


def test_invalid_low_arrival_limit():
    response = client.get(
        "/api/transit/arrivals?limit=0"
    )

    assert response.status_code == 200

    data = response.json()

    assert len(
        data["arrivals"]
    ) <= 1


def test_reliability_history_hour_limit():
    response = client.get(
        "/api/analytics/reliability-history?hours=100"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["hours"] == 48