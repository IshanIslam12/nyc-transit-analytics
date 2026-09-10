import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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

import "leaflet/dist/leaflet.css";
import "./App.css";


const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";


type Arrival = {
  route_id: string;
  trip_id: string;
  stop_id: string;
  station_name: string;
  direction: string;
  arrival_time: string;
  arrival_timestamp?: number;
  seconds_away?: number;
  minutes_away: number;
  feed?: string;
};


type Station = {
  stop_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
};


type ServiceAlert = {
  id: string;
  routes: string[];
  stops: string[];
  effect: string;
  header: string;
  description: string;
};


type ReliabilityItem = {
  route_id: string;
  average_prediction_change_minutes: number;
  delayed_prediction_percentage: number;
  samples: number;
};


type ReliabilityHistoryPoint = {
  timestamp: string;
  display_time: string;
  average_prediction_change_minutes: number;
  samples: number;
};


const ROUTES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "6X",
  "7",
  "7X",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "FX",
  "G",
  "H",
  "J",
  "L",
  "M",
  "N",
  "Q",
  "R",
  "W",
  "Z",
  "FS",
  "GS",
];


function App() {
  const [arrivals, setArrivals] =
    useState<Arrival[]>([]);

  const [stations, setStations] =
    useState<Station[]>([]);

  const [alerts, setAlerts] =
    useState<ServiceAlert[]>([]);

  const [reliability, setReliability] =
    useState<ReliabilityItem[]>([]);

  const [
    reliabilityHistory,
    setReliabilityHistory,
  ] = useState<
    ReliabilityHistoryPoint[]
  >([]);

  const [
    selectedRoute,
    setSelectedRoute,
  ] = useState("");

  const [
    stationSearch,
    setStationSearch,
  ] = useState("");

  const [
    selectedStation,
    setSelectedStation,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState<Date | null>(null);


  // ============================================================
  // STATIONS
  // ============================================================

  const fetchStations =
    useCallback(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/transit/stations`
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load stations."
          );
        }

        const data =
          await response.json();

        const rawStations =
          Array.isArray(data)
            ? data
            : Array.isArray(
                  data?.stations
                )
              ? data.stations
              : [];

        const normalized: Station[] =
          rawStations
            .map((station: any) => ({
              stop_id:
                station.stop_id ?? "",

              station_name:
                station.station_name ??
                station.name ??
                "",

              latitude: Number(
                station.latitude ??
                  station.lat
              ),

              longitude: Number(
                station.longitude ??
                  station.lon
              ),
            }))
            .filter(
              (station: Station) =>
                station.stop_id &&
                station.station_name &&
                Number.isFinite(
                  station.latitude
                ) &&
                Number.isFinite(
                  station.longitude
                )
            );

        setStations(normalized);
      } catch (err) {
        console.error(
          "Stations error:",
          err
        );
      }
    }, []);


  // ============================================================
  // ARRIVALS
  // ============================================================

  const fetchArrivals =
    useCallback(async () => {
      if (!selectedStation) {
        setArrivals([]);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const params =
          new URLSearchParams();

        params.set("limit", "50");

        params.set(
          "station",
          selectedStation
        );

        if (selectedRoute) {
          params.set(
            "route_id",
            selectedRoute
          );
        }

        const response = await fetch(
          `${API_BASE_URL}/api/transit/arrivals?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load arrivals."
          );
        }

        const data =
          await response.json();

        const rawArrivals =
          Array.isArray(data)
            ? data
            : Array.isArray(
                  data?.arrivals
                )
              ? data.arrivals
              : [];

        const normalized: Arrival[] =
          rawArrivals
            .map((arrival: any) => ({
              route_id:
                arrival.route_id ?? "",

              trip_id:
                arrival.trip_id ?? "",

              stop_id:
                arrival.stop_id ?? "",

              station_name:
                arrival.station_name ??
                "",

              direction:
                arrival.direction ??
                "Unknown",

              arrival_time:
                arrival.arrival_time ??
                "",

              arrival_timestamp:
                arrival.arrival_timestamp,

              seconds_away:
                arrival.seconds_away,

              minutes_away: Number(
                arrival.minutes_away ??
                  0
              ),

              feed:
                arrival.feed,
            }))
            .sort(
              (
                a: Arrival,
                b: Arrival
              ) =>
                a.minutes_away -
                b.minutes_away
            );

        setArrivals(normalized);
        setLastUpdated(new Date());
      } catch (err) {
        console.error(
          "Arrivals error:",
          err
        );

        setError(
          "Unable to load live arrivals."
        );
      } finally {
        setLoading(false);
      }
    }, [
      selectedStation,
      selectedRoute,
    ]);


  // ============================================================
  // ALERTS
  // ============================================================

  const fetchAlerts =
    useCallback(async () => {
      try {
        const params =
          new URLSearchParams();

        if (selectedRoute) {
          params.set(
            "route_id",
            selectedRoute
          );
        }

        const query =
          params.toString();

        const url = query
          ? `${API_BASE_URL}/api/transit/alerts?${query}`
          : `${API_BASE_URL}/api/transit/alerts`;

        const response =
          await fetch(url);

        if (!response.ok) {
          throw new Error(
            "Unable to load alerts."
          );
        }

        const data =
          await response.json();

        const rawAlerts =
          Array.isArray(data)
            ? data
            : Array.isArray(
                  data?.alerts
                )
              ? data.alerts
              : [];

        const normalized: ServiceAlert[] =
          rawAlerts.map(
            (
              alert: any,
              index: number
            ) => ({
              id:
                alert.id ??
                `alert-${index}`,

              routes:
                Array.isArray(
                  alert.routes
                )
                  ? alert.routes
                  : [],

              stops:
                Array.isArray(
                  alert.stops
                )
                  ? alert.stops
                  : [],

              effect:
                alert.effect ??
                "Unknown Effect",

              header:
                alert.header ??
                "MTA Service Alert",

              description:
                alert.description ??
                "",
            })
          );

        setAlerts(normalized);
      } catch (err) {
        console.error(
          "Alerts error:",
          err
        );

        setAlerts([]);
      }
    }, [selectedRoute]);


  // ============================================================
  // ROUTE RELIABILITY
  // ============================================================

  const fetchReliability =
    useCallback(async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/analytics/route-reliability`
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load route reliability."
          );
        }

        const data =
          await response.json();

        const rawRoutes =
          Array.isArray(data)
            ? data
            : Array.isArray(
                  data?.routes
                )
              ? data.routes
              : [];

        const normalized: ReliabilityItem[] =
          rawRoutes
            .map((item: any) => ({
              route_id:
                String(
                  item.route_id ?? ""
                ),

              average_prediction_change_minutes:
                Number(
                  item.average_prediction_change_minutes ??
                    0
                ),

              delayed_prediction_percentage:
                Number(
                  item.delayed_prediction_percentage ??
                    0
                ),

              samples:
                Number(
                  item.samples ?? 0
                ),
            }))
            .filter(
              (
                item: ReliabilityItem
              ) =>
                item.route_id &&
                Number.isFinite(
                  item.delayed_prediction_percentage
                )
            );

        setReliability(normalized);
      } catch (err) {
        console.error(
          "Reliability error:",
          err
        );

        setReliability([]);
      }
    }, []);


  // ============================================================
  // RELIABILITY HISTORY
  // ============================================================

  const fetchReliabilityHistory =
    useCallback(async () => {
      try {
        const params =
          new URLSearchParams();

        params.set(
          "hours",
          "24"
        );

        if (selectedRoute) {
          params.set(
            "route_id",
            selectedRoute
          );
        }

        const response = await fetch(
          `${API_BASE_URL}/api/analytics/reliability-history?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load reliability history."
          );
        }

        const data =
          await response.json();

        const rawPoints =
          Array.isArray(data)
            ? data
            : Array.isArray(
                  data?.points
                )
              ? data.points
              : [];

        const normalized:
          ReliabilityHistoryPoint[] =
          rawPoints
            .map((item: any) => {
              const timestamp =
                String(
                  item.timestamp ??
                    ""
                );

              const date =
                new Date(timestamp);

              const displayTime =
                !Number.isNaN(
                  date.getTime()
                )
                  ? date.toLocaleTimeString(
                      [],
                      {
                        hour: "numeric",
                        minute: "2-digit",
                      }
                    )
                  : timestamp;

              return {
                timestamp,

                display_time:
                  displayTime,

                average_prediction_change_minutes:
                  Number(
                    item.average_prediction_change_minutes ??
                      0
                  ),

                samples:
                  Number(
                    item.samples ??
                      0
                  ),
              };
            })
            .filter(
              (
                point: ReliabilityHistoryPoint
              ) =>
                point.timestamp &&
                Number.isFinite(
                  point.average_prediction_change_minutes
                )
            );

        setReliabilityHistory(
          normalized
        );
      } catch (err) {
        console.error(
          "History error:",
          err
        );

        setReliabilityHistory(
          []
        );
      }
    }, [selectedRoute]);


  // ============================================================
  // LOAD DATA
  // ============================================================

  useEffect(() => {
    fetchStations();
    fetchReliability();
  }, [
    fetchStations,
    fetchReliability,
  ]);


  useEffect(() => {
    fetchAlerts();
    fetchReliabilityHistory();
  }, [
    fetchAlerts,
    fetchReliabilityHistory,
  ]);


  // ============================================================
  // ARRIVAL REFRESH
  // ============================================================

  useEffect(() => {
    fetchArrivals();

    if (!selectedStation) {
      return;
    }

    const interval =
      window.setInterval(
        fetchArrivals,
        30_000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [
    fetchArrivals,
    selectedStation,
  ]);


  // ============================================================
  // ANALYTICS REFRESH
  // ============================================================

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          fetchReliability();
          fetchReliabilityHistory();
          fetchAlerts();
        },
        60_000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [
    fetchReliability,
    fetchReliabilityHistory,
    fetchAlerts,
  ]);


  // ============================================================
  // SEARCH
  // ============================================================

  const stationSuggestions =
    useMemo(() => {
      const search =
        stationSearch
          .trim()
          .toLowerCase();

      if (
        !search ||
        selectedStation
      ) {
        return [];
      }

      return stations
        .filter((station) =>
          station.station_name
            .toLowerCase()
            .includes(search)
        )
        .slice(0, 8);
    }, [
      stationSearch,
      selectedStation,
      stations,
    ]);


  // ============================================================
  // CHART DATA
  // ============================================================

  const reliabilityChartData =
    useMemo(() => {
      if (!selectedRoute) {
        return reliability;
      }

      return reliability.filter(
        (item) =>
          item.route_id ===
          selectedRoute
      );
    }, [
      reliability,
      selectedRoute,
    ]);


  // ============================================================
  // SELECT STATION
  // ============================================================

  const chooseStation = (
    stationName: string
  ) => {
    setStationSearch(
      stationName
    );

    setSelectedStation(
      stationName
    );
  };


  const clearStation = () => {
    setStationSearch("");
    setSelectedStation("");
    setArrivals([]);
  };


  // ============================================================
  // REFRESH ALL
  // ============================================================

  const refreshDashboard =
    async () => {
      await Promise.all([
        fetchArrivals(),
        fetchAlerts(),
        fetchReliability(),
        fetchReliabilityHistory(),
      ]);
    };


  // ============================================================
  // STATS
  // ============================================================

  const routesTracked =
    useMemo(() => {
      return new Set(
        reliability.map(
          (item) =>
            item.route_id
        )
      ).size;
    }, [reliability]);


  // ============================================================
  // ARRIVAL FORMAT
  // ============================================================

  const formatMinutes = (
    minutes: number
  ) => {
    if (minutes <= 0) {
      return "Due";
    }

    return `${minutes} min`;
  };


  return (
    <div className="app">
      <main className="dashboard-container">

        {/* HEADER */}

        <header className="dashboard-header">
          <div>
            <div className="eyebrow">
              MTA GTFS-Realtime
            </div>

            <h1>
              NYC Transit Analytics
            </h1>

            <p className="subtitle">
              Live subway arrivals,
              prediction stability,
              service alerts, and
              historical transit analytics.
            </p>
          </div>

          <div className="header-actions">
            <div className="live-status">
              <span className="live-dot" />

              Live data
            </div>

            {lastUpdated && (
              <span className="last-updated">
                Updated{" "}
                {lastUpdated.toLocaleTimeString(
                  [],
                  {
                    hour: "numeric",
                    minute: "2-digit",
                  }
                )}
              </span>
            )}

            <button
              className="refresh-button"
              onClick={
                refreshDashboard
              }
            >
              Refresh
            </button>
          </div>
        </header>


        {/* FILTERS */}

        <section className="filters-card">

          <div className="filter-group">
            <label>
              Subway Route
            </label>

            <select
              value={selectedRoute}
              onChange={(event) =>
                setSelectedRoute(
                  event.target.value
                )
              }
            >
              <option value="">
                All routes
              </option>

              {ROUTES.map(
                (route) => (
                  <option
                    key={route}
                    value={route}
                  >
                    {route} Train
                  </option>
                )
              )}
            </select>
          </div>


          <div className="filter-group station-search-group">
            <label>
              Station
            </label>

            <div className="station-search-wrapper">
              <input
                type="text"
                placeholder="Search for a station..."
                value={
                  stationSearch
                }
                onChange={(
                  event
                ) => {
                  setStationSearch(
                    event.target.value
                  );

                  if (
                    selectedStation
                  ) {
                    setSelectedStation(
                      ""
                    );
                  }
                }}
              />

              {stationSuggestions.length >
                0 && (
                <div className="station-suggestions">
                  {stationSuggestions.map(
                    (station) => (
                      <button
                        type="button"
                        key={
                          station.stop_id
                        }
                        onClick={() =>
                          chooseStation(
                            station.station_name
                          )
                        }
                      >
                        {
                          station.station_name
                        }
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>


          {selectedStation && (
            <button
              className="clear-filter-button"
              onClick={
                clearStation
              }
            >
              Clear station
            </button>
          )}

        </section>


        {/* STAT CARDS */}

        <section className="stats-grid">

          <div className="stat-card">
            <span>
              Live Arrivals
            </span>

            <strong>
              {selectedStation
                ? arrivals.length
                : "—"}
            </strong>

            <small>
              {selectedStation ||
                "Select a station"}
            </small>
          </div>


          <div className="stat-card">
            <span>
              Routes Tracked
            </span>

            <strong>
              {routesTracked}
            </strong>

            <small>
              Realtime routes
            </small>
          </div>


          <div className="stat-card">
            <span>
              Active Alerts
            </span>

            <strong>
              {alerts.length}
            </strong>

            <small>
              Current notices
            </small>
          </div>


          <div className="stat-card">
            <span>
              Stations Loaded
            </span>

            <strong>
              {stations.length}
            </strong>

            <small>
              Subway stations
            </small>
          </div>

        </section>


        {/* CHARTS */}

        <section className="analytics-grid">

          <article className="card chart-card">

            <div className="card-header">
              <div>
                <h2>
                  Prediction Delay Rate
                </h2>

                <p>
                  Percentage of realtime
                  predictions that moved
                  later. Lower is more
                  stable.
                </p>
              </div>
            </div>

            <div className="chart-container">
              {reliabilityChartData.length >
              0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={340}
                >
                  <BarChart
                    data={
                      reliabilityChartData
                    }
                    margin={{
                      top: 10,
                      right: 10,
                      left: 0,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="route_id"
                    />

                    <YAxis
                      domain={[0, 35]}
                      tickFormatter={(
                        value
                      ) =>
                        `${value}%`
                      }
                    />

                    <Tooltip
                      formatter={(
                        value
                      ) => [
                        `${Number(
                          value
                        ).toFixed(2)}%`,
                        "Prediction delay rate",
                      ]}
                    />

                    <Bar
                      dataKey="delayed_prediction_percentage"
                      fill="#2563eb"
                      radius={[
                        5,
                        5,
                        0,
                        0,
                      ]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  No route prediction
                  data available yet.
                </div>
              )}
            </div>

          </article>


          <article className="card chart-card">

            <div className="card-header">
              <div>
                <h2>
                  Prediction Stability
                </h2>

                <p>
                  Average change in
                  predicted arrival time
                  during each five-minute
                  interval.
                </p>
              </div>
            </div>

            <div className="chart-container">
              {reliabilityHistory.length >
              0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={340}
                >
                  <LineChart
                    data={
                      reliabilityHistory
                    }
                    margin={{
                      top: 10,
                      right: 20,
                      left: 0,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="display_time"
                      minTickGap={35}
                    />

                    <YAxis
                      domain={[
                        0,
                        "auto",
                      ]}
                      tickFormatter={(
                        value
                      ) =>
                        `${value}m`
                      }
                    />

                    <Tooltip
                      formatter={(
                        value
                      ) => [
                        `${Number(
                          value
                        ).toFixed(2)} min`,
                        "Average prediction change",
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="average_prediction_change_minutes"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{
                        r: 5,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  No historical prediction
                  data available yet.
                </div>
              )}
            </div>

          </article>

        </section>


        {/* ALERTS */}

        <section className="card">

          <div className="card-header">
            <div>
              <h2>
                Active Service Alerts
              </h2>

              <p>
                Current MTA subway
                service notices.
              </p>
            </div>

            <span className="section-count">
              {alerts.length}
            </span>
          </div>


          {alerts.length === 0 ? (
            <div className="empty-state">
              No active service alerts.
            </div>
          ) : (
            <div className="alerts-list">
              {alerts.map(
                (alert) => (
                  <article
                    className="alert-item"
                    key={alert.id}
                  >
                    <div className="alert-top-row">
                      <strong>
                        {alert.header}
                      </strong>

                      <span className="alert-effect">
                        {
                          alert.effect
                        }
                      </span>
                    </div>

                    {alert.routes
                      .length > 0 && (
                      <div className="alert-routes">
                        {alert.routes.map(
                          (route) => (
                            <span
                              className="mini-route"
                              key={
                                route
                              }
                            >
                              {
                                route
                              }
                            </span>
                          )
                        )}
                      </div>
                    )}

                    {alert.description && (
                      <p>
                        {
                          alert.description
                        }
                      </p>
                    )}
                  </article>
                )
              )}
            </div>
          )}

        </section>


        {/* MAP */}

        <section className="card map-card">

          <div className="card-header">
            <div>
              <h2>
                Subway Station Map
              </h2>

              <p>
                Click any station dot to
                load its live arrival
                board.
              </p>
            </div>

            <span className="section-count">
              {stations.length}
            </span>
          </div>


          <div className="map-wrapper">
            <MapContainer
              center={[
                40.7128,
                -74.006,
              ]}
              zoom={11}
              scrollWheelZoom
              style={{
                height: "500px",
                width: "100%",
              }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />


              {/* ALWAYS render every station */}

              {stations.map(
                (station) => {
                  const isSelected =
                    selectedStation ===
                    station.station_name;

                  return (
                    <CircleMarker
                      key={
                        station.stop_id
                      }
                      center={[
                        station.latitude,
                        station.longitude,
                      ]}
                      radius={
                        isSelected
                          ? 8
                          : 4
                      }
                      pathOptions={{
                        color:
                          isSelected
                            ? "#dc2626"
                            : "#2563eb",

                        fillColor:
                          isSelected
                            ? "#dc2626"
                            : "#2563eb",

                        fillOpacity:
                          isSelected
                            ? 0.95
                            : 0.65,

                        weight:
                          isSelected
                            ? 3
                            : 1,
                      }}
                      eventHandlers={{
                        click: () =>
                          chooseStation(
                            station.station_name
                          ),
                      }}
                    >
                      <Popup>
                        <div className="map-popup">
                          <strong>
                            {
                              station.station_name
                            }
                          </strong>

                          <button
                            type="button"
                            onClick={() =>
                              chooseStation(
                                station.station_name
                              )
                            }
                          >
                            View live arrivals
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                }
              )}

            </MapContainer>
          </div>

        </section>


        {/* LIVE ARRIVALS */}

        <section className="card arrivals-card">

          <div className="card-header">
            <div>
              <h2>
                Live Arrivals
              </h2>

              <p>
                {selectedStation
                  ? `Realtime arrivals for ${selectedStation}.`
                  : "Choose a station from search or the map."}
              </p>
            </div>

            {selectedStation && (
              <span className="section-count">
                {arrivals.length}{" "}
                {arrivals.length === 1
                  ? "arrival"
                  : "arrivals"}
              </span>
            )}
          </div>


          {!selectedStation ? (
            <div className="station-required-state">
              <div className="station-required-icon">
                🚇
              </div>

              <h3>
                Select a station
              </h3>

              <p>
                Search above or click a
                blue station marker on
                the map to see live MTA
                arrival predictions.
              </p>
            </div>
          ) : loading &&
            arrivals.length === 0 ? (
            <div className="empty-state">
              Loading live arrivals...
            </div>
          ) : error ? (
            <div className="empty-state">
              {error}
            </div>
          ) : arrivals.length === 0 ? (
            <div className="empty-state">
              No upcoming arrivals found
              for {selectedStation}.
            </div>
          ) : (
            <div className="arrivals-list">
              {arrivals.map(
                (arrival) => (
                  <article
                    className="arrival-item"
                    key={`${arrival.trip_id}-${arrival.stop_id}-${arrival.arrival_time}`}
                  >
                    <div className="route-badge">
                      {
                        arrival.route_id
                      }
                    </div>

                    <div className="arrival-details">
                      <strong>
                        {
                          arrival.station_name
                        }
                      </strong>

                      <span>
                        {
                          arrival.direction
                        }
                      </span>
                    </div>

                    <div className="arrival-time">
                      {formatMinutes(
                        arrival.minutes_away
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}

        </section>

      </main>
    </div>
  );
}


export default App;