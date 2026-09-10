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


const ARRIVAL_REFRESH_MS = 30_000;
const DASHBOARD_REFRESH_MS = 60_000;


type Station = {
  stop_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
};


type Arrival = {
  route_id: string;
  trip_id?: string;
  stop_id?: string;
  station_name: string;
  direction?: string;
  arrival_time?: string;
  arrival_timestamp?: number;
  seconds_away?: number;
  minutes_away?: number;
};


type ServiceAlert = {
  id?: string;
  header_text?: string;
  description_text?: string;
  routes?: string[];
  stops?: string[];
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
  const [stations, setStations] =
    useState<Station[]>([]);

  const [arrivals, setArrivals] =
    useState<Arrival[]>([]);

  const [alerts, setAlerts] =
    useState<ServiceAlert[]>([]);

  const [reliability, setReliability] =
    useState<ReliabilityItem[]>([]);

  const [
    reliabilityHistory,
    setReliabilityHistory,
  ] = useState<ReliabilityHistoryPoint[]>([]);

  const [selectedRoute, setSelectedRoute] =
    useState("");

  const [stationSearch, setStationSearch] =
    useState("");

  const [selectedStation, setSelectedStation] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);


  const fetchJson = useCallback(
    async (url: string, options?: RequestInit) => {
      const separator =
        url.includes("?") ? "&" : "?";

      const cacheBuster =
        `${separator}_=${Date.now()}`;

      const response = await fetch(
        `${url}${cacheBuster}`,
        {
          ...options,
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            ...(options?.headers || {}),
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Request failed: ${response.status}`
        );
      }

      return response.json();
    },
    []
  );


  const fetchStations = useCallback(
    async () => {
      try {
        const data = await fetchJson(
          `${API_BASE_URL}/api/transit/stations`
        );

        const stationData = Array.isArray(data)
          ? data
          : Array.isArray(data?.stations)
          ? data.stations
          : [];

        const normalizedStations =
          stationData
            .map((station: any) => ({
              stop_id: String(
                station.stop_id ?? ""
              ),

              station_name: String(
                station.station_name ?? ""
              ),

              latitude: Number(
                station.latitude
              ),

              longitude: Number(
                station.longitude
              ),
            }))
            .filter(
              (station: Station) =>
                station.station_name &&
                Number.isFinite(
                  station.latitude
                ) &&
                Number.isFinite(
                  station.longitude
                )
            );

        setStations(
          normalizedStations
        );
      } catch (err) {
        console.error(
          "Failed to fetch stations:",
          err
        );
      }
    },
    [fetchJson]
  );


  const fetchArrivals = useCallback(
    async () => {
      if (!selectedStation) {
        setArrivals([]);
        return;
      }

      try {
        const params =
          new URLSearchParams();

        params.set(
          "station",
          selectedStation
        );

        params.set(
          "limit",
          "100"
        );

        if (selectedRoute) {
          params.set(
            "route_id",
            selectedRoute
          );
        }

        const data = await fetchJson(
          `${API_BASE_URL}/api/transit/arrivals?${params.toString()}`
        );

        const arrivalData =
          Array.isArray(data)
            ? data
            : Array.isArray(
                data?.arrivals
              )
            ? data.arrivals
            : Array.isArray(
                data?.data?.arrivals
              )
            ? data.data.arrivals
            : [];

        const normalizedArrivals =
          arrivalData.map(
            (arrival: any) => ({
              route_id: String(
                arrival.route_id ?? ""
              ),

              trip_id:
                arrival.trip_id,

              stop_id:
                arrival.stop_id,

              station_name: String(
                arrival.station_name ??
                  selectedStation
              ),

              direction:
                arrival.direction,

              arrival_time:
                arrival.arrival_time,

              arrival_timestamp:
                arrival.arrival_timestamp !==
                undefined
                  ? Number(
                      arrival.arrival_timestamp
                    )
                  : undefined,

              seconds_away:
                arrival.seconds_away !==
                undefined
                  ? Number(
                      arrival.seconds_away
                    )
                  : undefined,

              minutes_away:
                arrival.minutes_away !==
                undefined
                  ? Number(
                      arrival.minutes_away
                    )
                  : undefined,
            })
          );

        setArrivals(
          normalizedArrivals
        );
      } catch (err) {
        console.error(
          "Failed to fetch arrivals:",
          err
        );

        setArrivals([]);
      }
    },
    [
      fetchJson,
      selectedRoute,
      selectedStation,
    ]
  );


  const fetchAlerts = useCallback(
    async () => {
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
          params.toString()
            ? `?${params.toString()}`
            : "";

        const data = await fetchJson(
          `${API_BASE_URL}/api/transit/alerts${query}`
        );

        const alertData =
          Array.isArray(data)
            ? data
            : Array.isArray(
                data?.alerts
              )
            ? data.alerts
            : Array.isArray(
                data?.data?.alerts
              )
            ? data.data.alerts
            : [];

        const normalizedAlerts =
          alertData.map(
            (alert: any) => ({
              id:
                alert.id !== undefined
                  ? String(alert.id)
                  : undefined,

              header_text: String(
                alert.header_text ??
                  alert.header ??
                  "Service Alert"
              ),

              description_text:
                String(
                  alert.description_text ??
                    alert.description ??
                    ""
                ),

              routes:
                Array.isArray(
                  alert.routes
                )
                  ? alert.routes.map(
                      String
                    )
                  : [],

              stops:
                Array.isArray(
                  alert.stops
                )
                  ? alert.stops.map(
                      String
                    )
                  : [],
            })
          );

        setAlerts(
          normalizedAlerts
        );
      } catch (err) {
        console.error(
          "Failed to fetch alerts:",
          err
        );

        setAlerts([]);
      }
    },
    [
      fetchJson,
      selectedRoute,
    ]
  );


  const fetchReliability =
    useCallback(
      async () => {
        try {
          const data =
            await fetchJson(
              `${API_BASE_URL}/api/analytics/route-reliability`
            );

          const routeData =
            Array.isArray(data)
              ? data
              : Array.isArray(
                  data?.routes
                )
              ? data.routes
              : [];

          const normalized =
            routeData
              .map((item: any) => ({
                route_id: String(
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

                samples: Number(
                  item.samples ?? 0
                ),
              }))
              .filter(
                (
                  item: ReliabilityItem
                ) =>
                  item.route_id
              );

          setReliability(
            normalized
          );
        } catch (err) {
          console.error(
            "Failed to fetch reliability:",
            err
          );

          setReliability([]);
        }
      },
      [fetchJson]
    );


  const fetchReliabilityHistory =
    useCallback(
      async () => {
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

          const data =
            await fetchJson(
              `${API_BASE_URL}/api/analytics/reliability-history?${params.toString()}`
            );

          const points =
            Array.isArray(data)
              ? data
              : Array.isArray(
                  data?.points
                )
              ? data.points
              : [];

          const normalized =
            points
              .map(
                (point: any) => {
                  const timestamp =
                    String(
                      point.timestamp ??
                        ""
                    );

                  let displayTime =
                    timestamp;

                  if (timestamp) {
                    const date =
                      new Date(
                        timestamp
                      );

                    if (
                      !Number.isNaN(
                        date.getTime()
                      )
                    ) {
                      displayTime =
                        date.toLocaleTimeString(
                          [],
                          {
                            hour: "numeric",
                            minute:
                              "2-digit",
                          }
                        );
                    }
                  }

                  return {
                    timestamp,

                    display_time:
                      displayTime,

                    average_prediction_change_minutes:
                      Number(
                        point.average_prediction_change_minutes ??
                          0
                      ),

                    samples:
                      Number(
                        point.samples ??
                          0
                      ),
                  };
                }
              )
              .filter(
                (
                  point:
                    ReliabilityHistoryPoint
                ) =>
                  point.timestamp
              );

          setReliabilityHistory(
            normalized
          );
        } catch (err) {
          console.error(
            "Failed to fetch reliability history:",
            err
          );

          setReliabilityHistory(
            []
          );
        }
      },
      [
        fetchJson,
        selectedRoute,
      ]
    );


  const refreshLiveData =
    useCallback(
      async () => {
        await fetchArrivals();

        setLastUpdated(
          new Date()
        );
      },
      [fetchArrivals]
    );


  const refreshDashboardData =
    useCallback(
      async () => {
        await Promise.allSettled([
          fetchAlerts(),
          fetchReliability(),
          fetchReliabilityHistory(),
        ]);

        setLastUpdated(
          new Date()
        );
      },
      [
        fetchAlerts,
        fetchReliability,
        fetchReliabilityHistory,
      ]
    );


  const refreshEverything =
    useCallback(
      async () => {
        setRefreshing(true);
        setError("");

        try {
          await Promise.allSettled([
            fetchArrivals(),
            fetchAlerts(),
            fetchReliability(),
            fetchReliabilityHistory(),
          ]);

          setLastUpdated(
            new Date()
          );
        } catch (err) {
          console.error(
            "Refresh failed:",
            err
          );

          setError(
            "Could not refresh transit data."
          );
        } finally {
          setRefreshing(false);
        }
      },
      [
        fetchArrivals,
        fetchAlerts,
        fetchReliability,
        fetchReliabilityHistory,
      ]
    );


  /*
   * Initial data load.
   *
   * Stations are static, so we only need
   * to load them once.
   */
  useEffect(() => {
    const initialize =
      async () => {
        setLoading(true);

        await Promise.allSettled([
          fetchStations(),
          fetchAlerts(),
          fetchReliability(),
          fetchReliabilityHistory(),
        ]);

        setLastUpdated(
          new Date()
        );

        setLoading(false);
      };

    initialize();
  }, [
    fetchStations,
    fetchAlerts,
    fetchReliability,
    fetchReliabilityHistory,
  ]);


  /*
   * Refresh arrivals whenever the user
   * changes the selected station or route.
   */
  useEffect(() => {
    fetchArrivals();
  }, [fetchArrivals]);


  /*
   * LIVE ARRIVALS AUTO REFRESH
   *
   * Runs every 30 seconds while the
   * website is open.
   */
  useEffect(() => {
    if (!selectedStation) {
      return;
    }

    const intervalId =
      window.setInterval(
        () => {
          refreshLiveData();
        },
        ARRIVAL_REFRESH_MS
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, [
    selectedStation,
    refreshLiveData,
  ]);


  /*
   * DASHBOARD AUTO REFRESH
   *
   * Refreshes alerts and historical
   * analytics every 60 seconds.
   */
  useEffect(() => {
    const intervalId =
      window.setInterval(
        () => {
          refreshDashboardData();
        },
        DASHBOARD_REFRESH_MS
      );

    return () => {
      window.clearInterval(
        intervalId
      );
    };
  }, [
    refreshDashboardData,
  ]);


  /*
   * When a user comes back to the tab,
   * immediately refresh the dashboard.
   *
   * Browsers can slow down intervals when
   * tabs are in the background.
   */
  useEffect(() => {
    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          refreshEverything();
        }
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [refreshEverything]);


  const stationSuggestions =
    useMemo(() => {
      const query =
        stationSearch
          .trim()
          .toLowerCase();

      if (
        query.length < 1 ||
        selectedStation
      ) {
        return [];
      }

      const uniqueNames =
        Array.from(
          new Set(
            stations.map(
              (station) =>
                station.station_name
            )
          )
        );

      return uniqueNames
        .filter((name) =>
          name
            .toLowerCase()
            .includes(query)
        )
        .slice(0, 10);
    }, [
      stationSearch,
      selectedStation,
      stations,
    ]);


  const chooseStation = (
    stationName: string
  ) => {
    setSelectedStation(
      stationName
    );

    setStationSearch(
      stationName
    );
  };


  const clearStation = () => {
    setSelectedStation("");
    setStationSearch("");
    setArrivals([]);
  };


  const formatMinutes = (
    minutes?: number
  ) => {
    if (
      minutes === undefined ||
      Number.isNaN(minutes)
    ) {
      return "—";
    }

    if (minutes <= 0) {
      return "Due";
    }

    return `${minutes} min`;
  };


  const routesTracked =
    reliability.length;


  return (
    <div className="app">
      <main className="dashboard-container">

        <header className="dashboard-header">
          <div>
            <div className="eyebrow">
              MTA GTFS-REALTIME
            </div>

            <h1>
              NYC Transit Analytics
            </h1>

            <p className="header-description">
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

            <button
              type="button"
              className="refresh-button"
              onClick={
                refreshEverything
              }
              disabled={refreshing}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </header>


        <div className="updated-row">
          {lastUpdated ? (
            <span>
              Updated{" "}
              {lastUpdated.toLocaleTimeString()}
              {" "}• arrivals refresh
              every 30 sec • analytics
              every 60 sec
            </span>
          ) : (
            <span>
              Connecting to live data...
            </span>
          )}
        </div>


        {error && (
          <div className="error-message">
            {error}
          </div>
        )}


        <section className="filters-card">
          <div className="filter-group">
            <label htmlFor="route-select">
              Subway Route
            </label>

            <select
              id="route-select"
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
                    {route}
                  </option>
                )
              )}
            </select>
          </div>


          <div className="filter-group station-filter">
            <label htmlFor="station-search">
              Station
            </label>

            <div className="station-search-wrapper">
              <input
                id="station-search"
                type="text"
                value={stationSearch}
                placeholder="Search for a station..."
                autoComplete="off"
                onChange={(event) => {
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

              {stationSearch && (
                <button
                  type="button"
                  className="clear-button"
                  onClick={
                    clearStation
                  }
                  aria-label="Clear station"
                >
                  ×
                </button>
              )}

              {stationSuggestions.length >
                0 && (
                <div className="station-suggestions">
                  {stationSuggestions.map(
                    (name) => (
                      <button
                        type="button"
                        key={name}
                        onClick={() =>
                          chooseStation(
                            name
                          )
                        }
                      >
                        {name}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </section>


        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">
              Live Arrivals
            </span>

            <strong>
              {selectedStation
                ? arrivals.length
                : "—"}
            </strong>

            <span className="stat-caption">
              {selectedStation
                ? selectedStation
                : "Select a station"}
            </span>
          </div>


          <div className="stat-card">
            <span className="stat-label">
              Routes Tracked
            </span>

            <strong>
              {routesTracked}
            </strong>

            <span className="stat-caption">
              Reliability routes
            </span>
          </div>


          <div className="stat-card">
            <span className="stat-label">
              Active Alerts
            </span>

            <strong>
              {alerts.length}
            </strong>

            <span className="stat-caption">
              Current notices
            </span>
          </div>


          <div className="stat-card">
            <span className="stat-label">
              Stations Loaded
            </span>

            <strong>
              {stations.length}
            </strong>

            <span className="stat-caption">
              Subway stations
            </span>
          </div>
        </section>


        <section className="analytics-grid">

          <div className="chart-card">
            <div className="card-heading">
              <h2>
                Prediction Delay Rate
              </h2>

              <p>
                Percentage of realtime
                predictions that moved later.
                Lower is more stable.
              </p>
            </div>

            <div className="chart-container">
              {reliability.length >
              0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <BarChart
                    data={reliability}
                    margin={{
                      top: 10,
                      right: 15,
                      bottom: 10,
                      left: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="route_id"
                    />

                    <YAxis
                      domain={[0, 100]}
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
                        "Delayed predictions",
                      ]}
                    />

                    <Bar
                      dataKey="delayed_prediction_percentage"
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
          </div>


          <div className="chart-card">
            <div className="card-heading">
              <h2>
                Prediction Stability
              </h2>

              <p>
                Average change in predicted
                arrival time during each
                five-minute interval.
              </p>
            </div>

            <div className="chart-container">
              {reliabilityHistory.length >
              0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <LineChart
                    data={
                      reliabilityHistory
                    }
                    margin={{
                      top: 10,
                      right: 15,
                      bottom: 10,
                      left: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                    />

                    <XAxis
                      dataKey="display_time"
                      minTickGap={35}
                    />

                    <YAxis />

                    <Tooltip
                      formatter={(
                        value
                      ) => [
                        `${Number(
                          value
                        ).toFixed(2)} min`,
                        "Avg prediction change",
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="average_prediction_change_minutes"
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
          </div>

        </section>


        <section className="section-card">
          <div className="card-heading">
            <h2>
              Active Service Alerts
            </h2>

            <p>
              Current MTA subway
              service notices.
            </p>
          </div>

          {alerts.length > 0 ? (
            <div className="alerts-list">
              {alerts.map(
                (alert, index) => (
                  <article
                    className="alert-card"
                    key={
                      alert.id ??
                      `${alert.header_text}-${index}`
                    }
                  >
                    <div className="alert-header">
                      <strong>
                        {alert.header_text ||
                          "Service Alert"}
                      </strong>

                      {alert.routes &&
                        alert.routes
                          .length > 0 && (
                          <span className="alert-routes">
                            {alert.routes.join(
                              ", "
                            )}
                          </span>
                        )}
                    </div>

                    {alert.description_text && (
                      <p>
                        {
                          alert.description_text
                        }
                      </p>
                    )}
                  </article>
                )
              )}
            </div>
          ) : (
            <div className="empty-state">
              No active service alerts.
            </div>
          )}
        </section>


        <section className="section-card">
          <div className="card-heading">
            <h2>
              Subway Station Map
            </h2>

            <p>
              Click any station dot to
              load its live arrival board.
            </p>
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
                height: "520px",
                width: "100%",
              }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

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
                        <strong>
                          {
                            station.station_name
                          }
                        </strong>

                        <br />

                        Click to view
                        arrivals
                      </Popup>
                    </CircleMarker>
                  );
                }
              )}
            </MapContainer>
          </div>
        </section>


        <section className="section-card">
          <div className="card-heading">
            <h2>
              Live Arrivals
            </h2>

            <p>
              {selectedStation
                ? `Realtime arrival predictions for ${selectedStation}. Automatically refreshes every 30 seconds.`
                : "Choose a station from search or the map."}
            </p>
          </div>

          {!selectedStation ? (
            <div className="empty-state">
              <strong>
                Select a station
              </strong>

              <p>
                Search above or click a
                station marker on the map
                to see live MTA arrival
                predictions.
              </p>
            </div>
          ) : arrivals.length ===
            0 ? (
            <div className="empty-state">
              No upcoming arrivals found
              for this station.
            </div>
          ) : (
            <div className="arrivals-list">
              {arrivals.map(
                (
                  arrival,
                  index
                ) => (
                  <div
                    className="arrival-row"
                    key={`${arrival.trip_id ?? "trip"}-${arrival.stop_id ?? "stop"}-${arrival.arrival_timestamp ?? index}`}
                  >
                    <div className="arrival-route">
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
                        {arrival.direction ||
                          "Direction unavailable"}
                      </span>
                    </div>

                    <div className="arrival-time">
                      {formatMinutes(
                        arrival.minutes_away
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>


        {loading && (
          <div className="loading-overlay">
            Loading transit data...
          </div>
        )}

      </main>
    </div>
  );
}


export default App;