import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";

import "./App.css";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

type Arrival = {
  route_id: string;
  trip_id: string;
  stop_id: string;
  station_name: string;
  direction: string;
  arrival_time: string;
  minutes_away: number;
};

type ReliabilityItem = {
  route_id: string;
  average_prediction_change_minutes: number;
  samples: number;
};

type ReliabilityHistoryPoint = {
  timestamp: string;
  average_prediction_change_minutes: number;
  samples: number;
};

type Station = {
  stop_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
};

type ActivePeriod = {
  start: string | null;
  end: string | null;
};

type ServiceAlert = {
  id: string;
  routes: string[];
  stops: string[];
  effect: string;
  header: string;
  description: string;
  active_periods: ActivePeriod[];
};

function App() {
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [reliability, setReliability] = useState<ReliabilityItem[]>([]);
  const [reliabilityHistory, setReliabilityHistory] = useState<
    ReliabilityHistoryPoint[]
  >([]);

  const [stations, setStations] = useState<Station[]>([]);
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);

  const [selectedRoute, setSelectedRoute] = useState("");
  const [stationSearch, setStationSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchStations() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/transit/stations`
      );

      if (!response.ok) {
        throw new Error("Failed to load stations.");
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setStations(data);
        return;
      }

      if (data && Array.isArray(data.stations)) {
        setStations(data.stations);
        return;
      }

      setStations([]);
    } catch (err) {
      console.error("Station fetch error:", err);
      setStations([]);
    }
  }

  async function fetchArrivals(showLoading = false) {
    try {
      if (showLoading) {
        setLoading(true);
      }

      setError("");

      const params = new URLSearchParams();

      params.set("limit", "100");

      if (selectedRoute) {
        params.set("route_id", selectedRoute);
      }

      if (stationSearch.trim()) {
        params.set("station", stationSearch.trim());
      }

      const response = await fetch(
        `${API_BASE_URL}/api/transit/arrivals?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to load live arrivals.");
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setArrivals(data);
      } else if (data && Array.isArray(data.arrivals)) {
        setArrivals(data.arrivals);
      } else {
        setArrivals([]);
      }

      setLastUpdated(new Date());
    } catch (err) {
      console.error("Arrival fetch error:", err);

      setArrivals([]);

      setError(
        "Unable to load live transit data. Make sure the backend is running."
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  async function fetchReliability() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/analytics/route-reliability`
      );

      if (!response.ok) {
        throw new Error("Failed to load reliability data.");
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setReliability(data);
      } else if (data && Array.isArray(data.routes)) {
        setReliability(data.routes);
      } else if (data && Array.isArray(data.reliability)) {
        setReliability(data.reliability);
      } else {
        setReliability([]);
      }
    } catch (err) {
      console.error("Reliability fetch error:", err);
      setReliability([]);
    }
  }

  async function fetchReliabilityHistory() {
    try {
      const params = new URLSearchParams();

      params.set("hours", "6");

      if (selectedRoute) {
        params.set("route_id", selectedRoute);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/analytics/reliability-history?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load reliability history."
        );
      }

      const data = await response.json();

      if (data && Array.isArray(data.points)) {
        setReliabilityHistory(data.points);
      } else if (Array.isArray(data)) {
        setReliabilityHistory(data);
      } else {
        setReliabilityHistory([]);
      }
    } catch (err) {
      console.error(
        "Reliability history fetch error:",
        err
      );

      setReliabilityHistory([]);
    }
  }

  async function fetchAlerts() {
    try {
      const params = new URLSearchParams();

      if (selectedRoute) {
        params.set("route_id", selectedRoute);
      }

      const query = params.toString();

      const url = query
        ? `${API_BASE_URL}/api/transit/alerts?${query}`
        : `${API_BASE_URL}/api/transit/alerts`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to load service alerts.");
      }

      const data = await response.json();

      const rawAlerts = Array.isArray(data)
        ? data
        : Array.isArray(data?.alerts)
          ? data.alerts
          : [];

      const normalizedAlerts: ServiceAlert[] =
        rawAlerts.map((alert: any, index: number) => {
          return {
            id:
              typeof alert?.id === "string"
                ? alert.id
                : `alert-${index}`,

            routes: Array.isArray(alert?.routes)
              ? alert.routes
              : Array.isArray(alert?.route_ids)
                ? alert.route_ids
                : [],

            stops: Array.isArray(alert?.stops)
              ? alert.stops
              : Array.isArray(alert?.stop_ids)
                ? alert.stop_ids
                : [],

            effect:
              typeof alert?.effect === "string"
                ? alert.effect
                : "",

            header:
              typeof alert?.header === "string"
                ? alert.header
                : typeof alert?.header_text === "string"
                  ? alert.header_text
                  : "MTA Service Alert",

            description:
              typeof alert?.description === "string"
                ? alert.description
                : typeof alert?.description_text === "string"
                  ? alert.description_text
                  : "",

            active_periods: Array.isArray(
              alert?.active_periods
            )
              ? alert.active_periods
              : [],
          };
        });

      setAlerts(normalizedAlerts);
    } catch (err) {
      console.error("Service alert fetch error:", err);
      setAlerts([]);
    }
  }

  async function refreshDashboard() {
    try {
      setRefreshing(true);

      await Promise.all([
        fetchArrivals(false),
        fetchReliability(),
        fetchReliabilityHistory(),
        fetchAlerts(),
      ]);

      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchStations();
  }, []);

  useEffect(() => {
    fetchArrivals(true);

    const interval = window.setInterval(() => {
      fetchArrivals(false);
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [selectedRoute, stationSearch]);

  useEffect(() => {
    fetchReliability();

    const interval = window.setInterval(() => {
      fetchReliability();
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchReliabilityHistory();

    const interval = window.setInterval(() => {
      fetchReliabilityHistory();
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, [selectedRoute]);

  useEffect(() => {
    fetchAlerts();

    const interval = window.setInterval(() => {
      fetchAlerts();
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, [selectedRoute]);

  const routeOptions = useMemo(() => {
    const routes = new Set<string>();

    reliability.forEach((item) => {
      if (item?.route_id) {
        routes.add(item.route_id);
      }
    });

    arrivals.forEach((arrival) => {
      if (arrival?.route_id) {
        routes.add(arrival.route_id);
      }
    });

    alerts.forEach((alert) => {
      alert.routes.forEach((route) => {
        if (route) {
          routes.add(route);
        }
      });
    });

    return Array.from(routes).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
      })
    );
  }, [reliability, arrivals, alerts]);

  const stationSuggestions = useMemo(() => {
    const search = stationSearch
      .trim()
      .toLowerCase();

    if (!search) {
      return [];
    }

    const uniqueNames = Array.from(
      new Set(
        stations
          .map((station) => station?.station_name)
          .filter(
            (name): name is string =>
              typeof name === "string"
          )
      )
    );

    return uniqueNames
      .filter((name) =>
        name.toLowerCase().includes(search)
      )
      .sort((a, b) => {
        const aStarts = a
          .toLowerCase()
          .startsWith(search);

        const bStarts = b
          .toLowerCase()
          .startsWith(search);

        if (aStarts && !bStarts) {
          return -1;
        }

        if (!aStarts && bStarts) {
          return 1;
        }

        return a.localeCompare(b);
      })
      .slice(0, 8);
  }, [stationSearch, stations]);

  const filteredReliability = useMemo(() => {
    if (!selectedRoute) {
      return reliability;
    }

    return reliability.filter(
      (item) => item.route_id === selectedRoute
    );
  }, [reliability, selectedRoute]);

  const formattedHistory = useMemo(() => {
    return reliabilityHistory.map((point) => {
      return {
        ...point,

        displayTime: new Date(
          point.timestamp
        ).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
      };
    });
  }, [reliabilityHistory]);

  const visibleStations = useMemo(() => {
    const stationNames = new Set(
      arrivals
        .map((arrival) => arrival?.station_name)
        .filter(
          (name): name is string =>
            typeof name === "string"
        )
    );

    if (stationSearch.trim()) {
      return stations.filter(
        (station) =>
          station?.station_name?.toLowerCase() ===
          stationSearch.trim().toLowerCase()
      );
    }

    if (
      selectedRoute &&
      stationNames.size > 0
    ) {
      return stations.filter((station) =>
        stationNames.has(station.station_name)
      );
    }

    return stations;
  }, [
    stations,
    arrivals,
    selectedRoute,
    stationSearch,
  ]);

  const routesTracked = useMemo(() => {
    return new Set(
      arrivals
        .map((arrival) => arrival?.route_id)
        .filter(Boolean)
    ).size;
  }, [arrivals]);

  function handleStationSelection(
    stationName: string
  ) {
    setStationSearch(stationName);
  }

  function clearStationFilter() {
    setStationSearch("");
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>NYC Transit Analytics</h1>

          <p>
            Real-time subway arrivals, prediction
            stability, service alerts, and station
            analytics.
          </p>
        </div>

        <div className="header-actions">
          <div className="live-status">
            <span className="live-dot" />
            Live Data
          </div>

          {lastUpdated && (
            <span className="last-updated">
              Updated{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}

          <button
            className="refresh-button"
            onClick={refreshDashboard}
            disabled={refreshing}
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>
      </header>

      <section className="filter-card">
        <div className="section-header">
          <div>
            <h2>Filter Transit Data</h2>

            <p>
              Filter live arrivals and analytics by
              route or station.
            </p>
          </div>
        </div>

        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="route-filter">
              Subway Route
            </label>

            <select
              id="route-filter"
              value={selectedRoute}
              onChange={(event) =>
                setSelectedRoute(
                  event.target.value
                )
              }
            >
              <option value="">
                All Routes
              </option>

              {routeOptions.map((route) => (
                <option
                  key={route}
                  value={route}
                >
                  {route}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group station-filter-group">
            <label htmlFor="station-filter">
              Station
            </label>

            <div className="station-search-wrapper">
              <input
                id="station-filter"
                type="text"
                value={stationSearch}
                placeholder="Search for a station..."
                autoComplete="off"
                onChange={(event) =>
                  setStationSearch(
                    event.target.value
                  )
                }
              />

              {stationSearch && (
                <button
                  type="button"
                  className="clear-station-button"
                  onClick={clearStationFilter}
                  aria-label="Clear station filter"
                >
                  ×
                </button>
              )}

              {stationSuggestions.length > 0 && (
                <div className="station-suggestions">
                  {stationSuggestions.map(
                    (stationName) => (
                      <button
                        key={stationName}
                        type="button"
                        onClick={() =>
                          handleStationSelection(
                            stationName
                          )
                        }
                      >
                        {stationName}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">
            Live Arrivals
          </span>

          <strong>{arrivals.length}</strong>

          <span className="stat-description">
            Current predictions
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            Routes Tracked
          </span>

          <strong>{routesTracked}</strong>

          <span className="stat-description">
            Routes in current results
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            Active Alerts
          </span>

          <strong>{alerts.length}</strong>

          <span className="stat-description">
            MTA service alerts
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">
            Stations Loaded
          </span>

          <strong>{stations.length}</strong>

          <span className="stat-description">
            Static GTFS stations
          </span>
        </div>
      </section>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <section className="analytics-grid">
        <div className="card">
          <div className="section-header">
            <div>
              <h2>Route Reliability</h2>

              <p>
                Average change in predicted arrival
                times by subway route.
              </p>
            </div>
          </div>

          <div className="chart-container">
            {filteredReliability.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height={320}
              >
                <BarChart
                  data={filteredReliability}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis dataKey="route_id" />

                  <YAxis />

                  <Tooltip
                    formatter={(value) => [
                      `${Number(value).toFixed(
                        2
                      )} min`,
                      "Avg. prediction change",
                    ]}
                  />

                  <Bar
                    dataKey="average_prediction_change_minutes"
                    name="Prediction Change"
                    fill="#2563eb"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                Not enough historical data yet.
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="section-header">
            <div>
              <h2>
                Prediction Stability Over Time
              </h2>

              <p>
                Average prediction changes in
                five-minute intervals over the last
                six hours.
              </p>
            </div>
          </div>

          <div className="chart-container">
            {formattedHistory.length > 0 ? (
              <ResponsiveContainer
                width="100%"
                height={320}
              >
                <LineChart
                  data={formattedHistory}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="displayTime"
                    minTickGap={25}
                  />

                  <YAxis />

                  <Tooltip
                    formatter={(value) => [
                      `${Number(value).toFixed(
                        2
                      )} min`,
                      "Avg. prediction change",
                    ]}
                  />

                  <Line
                    type="monotone"
                    dataKey="average_prediction_change_minutes"
                    name="Prediction Change"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                Not enough historical data yet.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="card alerts-card">
        <div className="section-header">
          <div>
            <h2>Active Service Alerts</h2>

            <p>
              Current service information from MTA
              GTFS-Realtime feeds.
            </p>
          </div>

          <span>{alerts.length} active</span>
        </div>

        {alerts.length > 0 ? (
          <div className="alert-list">
            {alerts.map((alert) => {
              const routes = Array.isArray(
                alert.routes
              )
                ? alert.routes
                : [];

              const stops = Array.isArray(
                alert.stops
              )
                ? alert.stops
                : [];

              return (
                <article
                  className="alert-item"
                  key={alert.id}
                >
                  <div className="alert-top-row">
                    <div className="alert-routes">
                      {routes.length > 0 ? (
                        routes.map((route) => (
                          <span
                            className="alert-route-badge"
                            key={`${alert.id}-${route}`}
                          >
                            {route}
                          </span>
                        ))
                      ) : (
                        <span className="alert-route-badge">
                          System
                        </span>
                      )}
                    </div>

                    {alert.effect && (
                      <span className="alert-effect">
                        {alert.effect
                          .replaceAll("_", " ")
                          .toLowerCase()}
                      </span>
                    )}
                  </div>

                  <h3>
                    {alert.header ||
                      "MTA Service Alert"}
                  </h3>

                  {alert.description && (
                    <p>{alert.description}</p>
                  )}

                  {stops.length > 0 && (
                    <div className="alert-stations">
                      <strong>
                        Affected stops:
                      </strong>{" "}
                      {stops
                        .slice(0, 10)
                        .join(", ")}

                      {stops.length > 10 &&
                        ` +${
                          stops.length - 10
                        } more`}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            No active service alerts for the
            current selection.
          </div>
        )}
      </section>

      <section className="card map-card">
        <div className="section-header">
          <div>
            <h2>
              NYC Subway Station Map
            </h2>

            <p>
              Click a station to filter the
              dashboard.
            </p>
          </div>

          <span>
            {visibleStations.length} stations shown
          </span>
        </div>

        <div className="map-container">
          <MapContainer
            center={[40.7128, -74.006]}
            zoom={11}
            scrollWheelZoom
            style={{
              height: "500px",
              width: "100%",
            }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {visibleStations.map((station) => (
              <CircleMarker
                key={station.stop_id}
                center={[
                  station.latitude,
                  station.longitude,
                ]}
                radius={5}
                pathOptions={{
                  color: "#2563eb",
                  fillColor: "#2563eb",
                  fillOpacity: 0.7,
                  weight: 1,
                }}
                eventHandlers={{
                  click: () =>
                    handleStationSelection(
                      station.station_name
                    ),
                }}
              >
                <Popup>
                  <strong>
                    {station.station_name}
                  </strong>

                  <br />

                  Stop ID: {station.stop_id}

                  <br />

                  <button
                    type="button"
                    onClick={() =>
                      handleStationSelection(
                        station.station_name
                      )
                    }
                  >
                    Filter by this station
                  </button>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </section>

      <section className="card arrivals-card">
        <div className="section-header">
          <div>
            <h2>Live Arrivals</h2>

            <p>
              Real-time subway arrival predictions
              from MTA GTFS-Realtime feeds.
            </p>
          </div>

          <span>{arrivals.length} results</span>
        </div>

        {loading ? (
          <div className="status-message">
            Loading live arrivals...
          </div>
        ) : arrivals.length > 0 ? (
          <div className="arrival-list">
            {arrivals.map(
              (arrival, index) => (
                <div
                  className="arrival-row"
                  key={`${arrival.trip_id}-${arrival.stop_id}-${arrival.arrival_time}-${index}`}
                >
                  <div className="arrival-route">
                    {arrival.route_id}
                  </div>

                  <div className="arrival-details">
                    <strong>
                      {arrival.station_name}
                    </strong>

                    <span>
                      {arrival.direction}
                    </span>
                  </div>

                  <div className="arrival-time">
                    {arrival.minutes_away === 0
                      ? "Arriving"
                      : `${arrival.minutes_away} min`}
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="empty-state">
            No arrivals found for the current
            filters.
          </div>
        )}
      </section>
    </div>
  );
}

export default App;