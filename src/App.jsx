import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Loader2, Search, Map as MapIcon, Cloud, Wind, Droplets, 
  Sun, Navigation, AlertCircle, Thermometer, Eye, 
  Wind as WindIcon, Menu, X, MapPin, Calendar, Clock,
  Activity, Layers, Waves, Gauge, Globe, Maximize2, Minimize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_KEY = "5d445c16eaac39b18ca87a89bc27675d"; 
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEO_URL = "https://api.openweathermap.org/geo/1.0";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

const App = () => {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [airQuality, setAirQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]);
  const [activeLayer, setActiveLayer] = useState('precipitation_new');
  const [isSatellite, setIsSatellite] = useState(false);
  const [isFullMap, setIsFullMap] = useState(false);
  
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const baseTileLayer = useRef(null);
  const weatherLayerInstance = useRef(null);
  const searchTimeout = useRef(null);

  // --- API & Logic ---
  const fetchWithRetry = async (url, retries = 3) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    return await response.json();
  };

  const getWeatherData = useCallback(async (lat, lon) => {
    setLoading(true);
    setSuggestions([]);
    setSearch(""); 
    try {
      const [currentData, forecastData, airData] = await Promise.all([
        fetchWithRetry(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
        fetchWithRetry(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`),
        fetchWithRetry(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`)
      ]);
      setWeather(currentData);
      setForecast(forecastData);
      setAirQuality(airData.list[0]);
      if (mapInstance.current) mapInstance.current.setView([lat, lon], 10);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  const handleLocateUser = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => getWeatherData(pos.coords.latitude, pos.coords.longitude),
        () => getWeatherData(40.7128, -74.0060)
      );
    }
  }, [getWeatherData]);

  useEffect(() => { handleLocateUser(); }, [handleLocateUser]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length > 2) {
      searchTimeout.current = setTimeout(async () => {
        const data = await fetchWithRetry(`${GEO_URL}/direct?q=${encodeURIComponent(value)}&limit=5&appid=${API_KEY}`);
        setSuggestions(data);
      }, 400);
    } else { setSuggestions([]); }
  };

  const updateMapLayer = (layerName) => {
    if (!mapInstance.current) return;
    setActiveLayer(layerName);
    if (weatherLayerInstance.current) mapInstance.current.removeLayer(weatherLayerInstance.current);
    const newLayer = window.L.tileLayer(`https://tile.openweathermap.org/map/${layerName}/{z}/{x}/{y}.png?appid=${API_KEY}`, { opacity: 0.5 });
    newLayer.addTo(mapInstance.current);
    weatherLayerInstance.current = newLayer;
  };

  useEffect(() => {
    const initLeaflet = () => {
      if (typeof window === 'undefined' || !window.L || mapInstance.current) return;
      const map = window.L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView(mapCenter, 8);
      baseTileLayer.current = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
      mapInstance.current = map;
      updateMapLayer('precipitation_new');
    };
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = LEAFLET_CSS; document.head.appendChild(link);
    const script = document.createElement("script"); script.src = LEAFLET_JS; script.onload = initLeaflet; document.head.appendChild(script);
  }, []);

  const getAQILevel = (aqi) => {
    const levels = { 1: { label: "Good", color: "text-green-400", bg: "bg-green-400/20" }, 2: { label: "Fair", color: "text-yellow-400", bg: "bg-yellow-400/20" }, 3: { label: "Moderate", color: "text-orange-400", bg: "bg-orange-400/20" }, 4: { label: "Poor", color: "text-red-400", bg: "bg-red-400/20" }, 5: { label: "Very Poor", color: "text-purple-400", bg: "bg-purple-400/20" } };
    return levels[aqi] || levels[1];
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050505] text-slate-100 font-sans">
      <div className="absolute inset-0 z-0" ref={mapContainerRef} />
      
      {/* NAVIGATION BAR */}
      <nav className="absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-4 z-[100] flex flex-col md:flex-row items-center justify-between gap-3 pointer-events-none">
        
        {/* Logo & Menu Toggle */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3 pointer-events-auto bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/10 rounded-xl">
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <Cloud className="w-6 h-6 text-blue-400" />
            <span className="text-sm font-black tracking-widest uppercase">Vhiteskies</span>
          </div>
        </div>

        {/* SEARCH BAR - Dynamic Border Logic */}
        <div className="relative w-full md:flex-1 md:max-w-lg pointer-events-auto group">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" value={search} onChange={handleSearchChange} placeholder="Search city..."
              className="w-full bg-black/60 backdrop-blur-2xl rounded-2xl py-3 pl-11 pr-12 text-sm 
                         border-2 border-blue-500/50 hover:border-green-500/80 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button onClick={handleLocateUser} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-400" title="Locate Me">
              <MapPin className="w-4 h-4" />
            </button>
          </div>

          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="absolute top-full mt-2 left-0 right-0 bg-black/90 backdrop-blur-3xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-[110]">
                {suggestions.map((city, idx) => (
                  <button key={idx} onClick={() => getWeatherData(city.lat, city.lon)}
                    className="w-full text-left px-5 py-3 hover:bg-blue-500/20 flex flex-col border-b border-white/5 last:border-0">
                    <span className="font-bold text-sm">{city.name}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{city.state ? `${city.state}, ` : ''}{city.country}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Map View Controls */}
        <div className="hidden md:flex items-center gap-2 pointer-events-auto">
          <button onClick={() => setIsSatellite(!isSatellite)} className={`p-3 rounded-2xl backdrop-blur-xl border transition-all ${isSatellite ? 'bg-blue-500 border-blue-400' : 'bg-black/60 border-white/10'}`} title="Satellite View">
            <Globe className="w-4 h-4" />
          </button>
          <button onClick={() => setIsFullMap(!isFullMap)} className={`p-3 rounded-2xl backdrop-blur-xl border transition-all ${isFullMap ? 'bg-emerald-500 border-emerald-400' : 'bg-black/60 border-white/10'}`} title="Full Map Mode">
            {isFullMap ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
        </div>
      </nav>

      {/* Layer Selectors (Sidebar Vertical) */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 pointer-events-auto">
        {[{ id: 'precipitation_new', icon: Waves, t: "Rain" }, { id: 'wind_new', icon: WindIcon, t: "Wind" }, { id: 'pressure_new', icon: Gauge, t: "Pressure" }, { id: 'temp_new', icon: Thermometer, t: "Temp" }].map(layer => (
          <button key={layer.id} onClick={() => updateMapLayer(layer.id)} title={layer.t} className={`p-4 rounded-2xl backdrop-blur-xl border transition-all ${activeLayer === layer.id ? 'bg-blue-500 border-blue-400' : 'bg-black/60 border-white/10'}`}>
            <layer.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* BOTTOM DASHBOARD */}
      <AnimatePresence>
        {!isFullMap && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="absolute bottom-6 left-6 right-6 z-30 pointer-events-none flex flex-col md:flex-row items-stretch gap-4">
            
            {/* 24H PROGRESSION - Priority 1 */}
            {forecast && (
              <div className="flex-1 h-[220px] md:h-[320px] bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 pointer-events-auto flex flex-col order-1">
                <span className="text-[10px] font-black uppercase text-slate-500 mb-4">24h Progression</span>
                <div className="flex-1 flex gap-4 overflow-x-auto no-scrollbar mask-fade-edges items-center">
                  {forecast.list.slice(0, 16).map((h, i) => (
                    <div key={i} className="min-w-[85px] flex flex-col items-center">
                      <p className="text-[9px] font-bold text-slate-500">{new Date(h.dt * 1000).getHours()}:00</p>
                      <img src={`https://openweathermap.org/img/wn/${h.weather[0].icon}.png`} className="w-8 h-8" alt="" />
                      <p className="text-lg font-black">{Math.round(h.main.temp)}°</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SIDEBAR MODAL - Positioned Under Progression on Mobile */}
            <AnimatePresence>
              {isSidebarOpen && weather && (
                <motion.div 
                  initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                  className="w-full md:w-[400px] h-auto md:h-[320px] bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 pointer-events-auto flex flex-col justify-between gap-4 order-2"
                >
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-black">{weather.name}</h2>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${getAQILevel(airQuality?.main?.aqi).bg} ${getAQILevel(airQuality?.main?.aqi).color}`}>
                      AQI: {getAQILevel(airQuality?.main?.aqi).label}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ l: "Wind", v: `${weather.wind.speed} m/s` }, { l: "Humidity", v: `${weather.main.humidity}%` }, { l: "Pressure", v: `${weather.main.pressure} hPa` }, { l: "Visibility", v: `${(weather.visibility / 1000).toFixed(1)} km` }].map((s, i) => (
                      <div key={i} className="bg-white/5 p-3 rounded-2xl border border-white/5">
                        <p className="text-[8px] text-slate-500 font-black uppercase">{s.l}</p>
                        <p className="text-xs font-bold">{s.v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-around bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20">
                    <div className="text-center"><p className="text-[7px] font-black opacity-60">PM2.5</p><p className="text-xs font-black">{airQuality?.components.pm2_5.toFixed(1)}</p></div>
                    <div className="text-center"><p className="text-[7px] font-black opacity-60">SO2</p><p className="text-xs font-black">{airQuality?.components.so2.toFixed(1)}</p></div>
                    <div className="text-center"><p className="text-[7px] font-black opacity-60">NO2</p><p className="text-xs font-black">{airQuality?.components.no2.toFixed(1)}</p></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .mask-fade-edges { mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent); }
        .leaflet-container { background: #000 !important; }
        .leaflet-tile { filter: brightness(0.8) contrast(1.2); }
      `}</style>
    </div>
  );
};

export default App;
