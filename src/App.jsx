import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Loader2, Search, Map as MapIcon, Cloud, Wind, Droplets, 
  Sun, Navigation, AlertCircle, Thermometer, Eye, 
  Wind as WindIcon, Menu, X, MapPin, Calendar, Clock,
  Activity, Layers, Waves, Gauge, Globe, Maximize2, Minimize2,
  Moon, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Configuration ---
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
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]);
  const [activeLayer, setActiveLayer] = useState('precipitation_new');
  const [isSatellite, setIsSatellite] = useState(false);
  const [isFullMap, setIsFullMap] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const baseTileLayer = useRef(null);
  const weatherLayerInstance = useRef(null);
  const searchTimeout = useRef(null);

  const isMobile = windowWidth < 768;

  // --- Resize Handler ---
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Map Tile Logic ---
  useEffect(() => {
    if (!mapInstance.current) return;
    if (baseTileLayer.current) mapInstance.current.removeLayer(baseTileLayer.current);

    let tileUrl = '';
    if (isSatellite) {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    } else {
      tileUrl = isDarkMode 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }

    baseTileLayer.current = window.L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: isSatellite ? 'Esri' : 'CartoDB'
    }).addTo(mapInstance.current);
  }, [isSatellite, isDarkMode]);

  const fetchWithRetry = async (url, retries = 3) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(res => setTimeout(res, 1000));
        return fetchWithRetry(url, retries - 1);
      }
      throw err;
    }
  };

  const getWeatherData = useCallback(async (lat, lon) => {
    setLoading(true);
    setError(null);
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
      setMapCenter([lat, lon]);
      
      if (mapInstance.current) mapInstance.current.setView([lat, lon], 10);
    } catch (err) {
      setError("Atmospheric sync failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLocateUser = useCallback(() => {
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => getWeatherData(pos.coords.latitude, pos.coords.longitude),
        () => getWeatherData(40.7128, -74.0060),
        { enableHighAccuracy: true }
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
        try {
          const data = await fetchWithRetry(`${GEO_URL}/direct?q=${encodeURIComponent(value)}&limit=5&appid=${API_KEY}`);
          setSuggestions(data);
        } catch (err) { console.error(err); }
      }, 400);
    } else { setSuggestions([]); }
  };

  const updateMapLayer = (layerName) => {
    if (!mapInstance.current) return;
    setActiveLayer(layerName);
    if (weatherLayerInstance.current) mapInstance.current.removeLayer(weatherLayerInstance.current);
    const newLayer = window.L.tileLayer(`https://tile.openweathermap.org/map/${layerName}/{z}/{x}/{y}.png?appid=${API_KEY}`, {
      opacity: 0.5, zIndex: 100
    });
    newLayer.addTo(mapInstance.current);
    weatherLayerInstance.current = newLayer;
  };

  useEffect(() => {
    const initLeaflet = () => {
      if (typeof window === 'undefined' || !window.L || !mapContainerRef.current || mapInstance.current) return;
      const map = window.L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView(mapCenter, 8);
      baseTileLayer.current = window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
      mapInstance.current = map;
      updateMapLayer('precipitation_new');
    };

    const loadScripts = () => {
      if (window.L) { initLeaflet(); return; }
      const link = document.createElement("link"); link.rel = "stylesheet"; link.href = LEAFLET_CSS; document.head.appendChild(link);
      const script = document.createElement("script"); script.src = LEAFLET_JS; script.async = true;
      script.onload = () => initLeaflet();
      document.head.appendChild(script);
    };
    loadScripts();
  }, []);

  const getAQILevel = (aqi) => {
    const levels = {
      1: { label: "Good", color: "text-green-400", bg: "bg-green-400/20", borderColor: "border-green-500/30" },
      2: { label: "Fair", color: "text-yellow-400", bg: "bg-yellow-400/20", borderColor: "border-yellow-500/30" },
      3: { label: "Moderate", color: "text-orange-400", bg: "bg-orange-400/20", borderColor: "border-orange-500/30" },
      4: { label: "Poor", color: "text-red-400", bg: "bg-red-400/20", borderColor: "border-red-500/30" },
      5: { label: "Very Poor", color: "text-purple-400", bg: "bg-purple-400/20", borderColor: "border-purple-500/30" }
    };
    return levels[aqi] || levels[1];
  };

  const themeClass = isDarkMode ? "bg-black/60 text-slate-100 border-white/10" : "bg-white/80 text-slate-900 border-black/10";
  const glassClass = isDarkMode ? "backdrop-blur-xl bg-black/60" : "backdrop-blur-xl bg-white/70";

  return (
    <div className={`relative h-screen w-screen overflow-hidden font-sans transition-colors duration-500 ${isDarkMode ? 'bg-[#050505]' : 'bg-slate-100'}`}>
      <div className="absolute inset-0 z-0" ref={mapContainerRef} />
      
      {/* Top Nav */}
      <nav className={`absolute left-2 right-2 md:left-4 md:right-4 z-[100] flex pointer-events-none ${isMobile ? 'top-2 flex-col gap-2' : 'top-4 items-center justify-between'}`}>
        
        {/* Logo Section */}
        <div className={`flex items-center pointer-events-auto border rounded-2xl ${glassClass} ${themeClass} ${isMobile ? 'justify-between w-full px-3 py-2' : 'gap-3 px-4 py-2'}`}>
          <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="p-1.5 md:p-2 hover:bg-white/10 rounded-xl"
                title={!isMobile ? (isSidebarOpen ? "Close Details" : "Open Details") : (isSidebarOpen ? "Close Control Panel" : "Open Control Panel")}
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-1.5">
              <Cloud className="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
              <span className="text-[10px] md:text-sm font-black tracking-widest uppercase">Vhiteskies</span>
            </div>
          </div>

          {isMobile && (
             <div className="flex items-center gap-2">
                <button onClick={() => setIsSatellite(!isSatellite)} title="Toggle Satellite View" className={`p-2 rounded-xl border transition-all ${isSatellite ? 'bg-blue-500 border-blue-400' : 'bg-black/60 border-white/10'}`}>
                  <Globe className="w-4 h-4" />
                </button>
                <button onClick={() => setIsFullMap(!isFullMap)} title="Toggle Full Map Mode" className={`p-2 rounded-xl border transition-all ${isFullMap ? 'bg-emerald-500 border-emerald-400' : 'bg-black/60 border-white/10'}`}>
                  {isFullMap ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
             </div>
          )}
        </div>

        {/* Search Bar */}
        <div className={`relative pointer-events-auto ${isMobile ? 'w-full' : 'flex-1 max-w-lg mx-4'}`}>
          <div className="relative group search-container">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" value={search} onChange={handleSearchChange} placeholder="Search city..."
              className={`w-full border-2 border-blue-500/50 rounded-2xl py-3 pl-11 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40 transition-all duration-300 search-input ${glassClass} ${isDarkMode ? 'text-white' : 'text-black'}`}
            />
            <button onClick={handleLocateUser} title="Get Current Location" className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-400">
              <MapPin className="w-4 h-4" />
            </button>
          </div>

          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className={`absolute top-full mt-2 left-0 right-0 border rounded-2xl overflow-hidden shadow-2xl z-[110] ${isDarkMode ? 'bg-black/90 border-white/10' : 'bg-white/95 border-black/10'}`}>
                {suggestions.map((city, idx) => (
                  <button key={idx} onClick={() => getWeatherData(city.lat, city.lon)}
                    className="w-full text-left px-5 py-3 hover:bg-blue-500/20 flex flex-col border-b border-white/5 last:border-0">
                    <span className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-black'}`}>{city.name}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{city.state ? `${city.state}, ` : ''}{city.country}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop Controls */}
        {!isMobile && (
          <div className="flex items-center gap-2 pointer-events-auto">
            <button onClick={() => setIsSatellite(!isSatellite)} title="Satellite Imagery" className={`p-3 rounded-2xl backdrop-blur-xl border transition-all ${isSatellite ? 'bg-blue-500 border-blue-400' : themeClass}`}>
              <Globe className="w-4 h-4" />
            </button>
            <button onClick={() => setIsFullMap(!isFullMap)} title="Expand Map View" className={`p-3 rounded-2xl backdrop-blur-xl border transition-all ${isFullMap ? 'bg-emerald-500 border-emerald-400' : themeClass}`}>
              {isFullMap ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
          </div>
        )}
      </nav>

      {/* Layer Controls */}
      <div className={`absolute z-40 flex flex-col gap-2 pointer-events-auto ${isMobile ? 'right-2 top-32' : 'right-4 top-24'}`}>
        {[
          { id: 'precipitation_new', icon: Waves, desc: "Rain/Precipitation" }, 
          { id: 'wind_new', icon: WindIcon, desc: "Wind Speed" }, 
          { id: 'pressure_new', icon: Gauge, desc: "Atmospheric Pressure" }, 
          { id: 'temp_new', icon: Thermometer, desc: "Temperature Map" }
        ].map(layer => (
          <button key={layer.id} onClick={() => updateMapLayer(layer.id)} title={layer.desc}
            className={`p-3 md:p-4 rounded-xl md:rounded-2xl backdrop-blur-xl border transition-all ${activeLayer === layer.id ? 'bg-blue-500 border-blue-400 text-white' : themeClass}`}>
            <layer.icon className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        ))}
      </div>

      {/* Main Dashboard */}
      <AnimatePresence>
        {!isFullMap && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} 
            className={`absolute z-30 pointer-events-none flex items-stretch gap-3 md:gap-4 ${isMobile ? 'bottom-4 left-4 right-4 flex-col' : 'bottom-6 left-6 right-6 flex-row'}`}
          >
            
            {/* 1. Weather Details (Left Side on Desktop, WIDER) */}
            <AnimatePresence>
              {(isSidebarOpen || !isMobile) && weather && (
                <motion.div 
                  initial={isMobile ? { y: 20, opacity: 0 } : { x: -50, opacity: 0 }} 
                  animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }} 
                  exit={isMobile ? { y: 20, opacity: 0 } : { x: -50, opacity: 0 }} 
                  className={`border p-4 md:p-6 pointer-events-auto flex flex-col justify-between gap-4 shadow-2xl ${glassClass} ${themeClass} ${isMobile ? 'w-full h-auto rounded-[1.5rem]' : 'md:w-[480px] h-[320px] rounded-[2rem]'}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-400" />
                        <h2 className="text-lg md:text-xl font-black">{weather.name}</h2>
                    </div>
                    <div title="Air Quality Index" className={`px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-black uppercase cursor-help ${getAQILevel(airQuality?.main?.aqi).bg} ${getAQILevel(airQuality?.main?.aqi).color}`}>
                      AQI: {getAQILevel(airQuality?.main?.aqi).label}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { l: "Wind Speed", v: `${weather.wind.speed} m/s`, i: Wind },
                      { l: "Humidity", v: `${weather.main.humidity}%`, i: Droplets },
                      { l: "Pressure", v: `${weather.main.pressure} hPa`, i: Gauge },
                      { l: "Visibility", v: `${(weather.visibility / 1000).toFixed(1)} km`, i: Eye }
                    ].map((s, i) => (
                      <div key={i} className="bg-blue-500/5 p-3 md:p-4 rounded-xl border border-white/5 hover:bg-blue-500/10 transition-colors">
                        <p className="text-[7px] md:text-[8px] text-slate-500 font-black uppercase flex items-center gap-1">
                            <s.i className="w-2 h-2" /> {s.l}
                        </p>
                        <p className="text-sm font-bold">{s.v}</p>
                      </div>
                    ))}
                  </div>
                  <div title="Detailed Pollutant Levels" className={`p-3 md:p-4 rounded-xl border flex justify-around items-center bg-opacity-10 cursor-help ${getAQILevel(airQuality?.main?.aqi).bg} ${getAQILevel(airQuality?.main?.aqi).borderColor}`}>
                    <div className="text-center"><p className="text-[7px] md:text-[8px] font-black opacity-60">PM2.5</p><p className="text-xs md:text-sm font-black">{airQuality?.components.pm2_5.toFixed(1)}</p></div>
                    <div className="text-center"><p className="text-[7px] md:text-[8px] font-black opacity-60">SO2</p><p className="text-xs md:text-sm font-black">{airQuality?.components.so2.toFixed(1)}</p></div>
                    <div className="text-center"><p className="text-[7px] md:text-[8px] font-black opacity-60">NO2</p><p className="text-xs md:text-sm font-black">{airQuality?.components.no2.toFixed(1)}</p></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 2. Forecast Panel (Right Side on Desktop) */}
            {forecast && (
              <div className={`border p-4 md:p-6 pointer-events-auto flex flex-col ${glassClass} ${themeClass} ${isMobile ? 'order-1 h-[180px] rounded-[1.5rem]' : 'flex-1 h-[320px] rounded-[2rem]'}`}>
                <div className="flex items-center gap-2 mb-2 md:mb-4">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">24h Progression</span>
                </div>
                <div className="flex-1 flex gap-4 overflow-x-auto no-scrollbar mask-fade-edges items-center">
                  {forecast.list.slice(0, 16).map((h, i) => (
                    <div key={i} className="min-w-[70px] md:min-w-[85px] flex flex-col items-center p-2 rounded-2xl hover:bg-blue-500/10 transition-colors cursor-help" title={h.weather[0].description}>
                      <p className="text-[8px] md:text-[9px] font-bold text-slate-500 mb-1">{new Date(h.dt * 1000).getHours()}:00</p>
                      <img src={`https://openweathermap.org/img/wn/${h.weather[0].icon}.png`} className="w-6 h-6 md:w-8 md:h-8 mb-1" alt="" />
                      <p className="text-sm md:text-lg font-black">{Math.round(h.main.temp)}°</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Dark Mode Toggle (Bottom Right) */}
      <button 
        onClick={() => setIsDarkMode(!isDarkMode)}
        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className={`fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[120] p-3 md:p-4 rounded-full shadow-2xl border-2 transition-all duration-300 hover:scale-110 active:scale-95 ${isDarkMode ? 'bg-blue-600 border-blue-400 text-white' : 'bg-yellow-400 border-yellow-600 text-black'}`}
      >
        {isDarkMode ? <Sun className="w-5 h-5 md:w-6 md:h-6" /> : <Moon className="w-5 h-5 md:w-6 md:h-6" />}
      </button>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .mask-fade-edges { mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent); }
        .leaflet-container { background: ${isDarkMode ? '#000' : '#f8fafc'} !important; transition: background 0.5s ease; }
        
        .search-input {
           border-color: rgba(59, 130, 246, 0.5);
        }
        .search-container:hover .search-input {
           border-color: rgba(34, 197, 94, 0.8) !important;
        }

        .leaflet-tile { 
           filter: ${isDarkMode ? 'brightness(0.8) contrast(1.2)' : 'none'} !important;
           transition: filter 0.5s ease;
        }
      `}</style>
    </div>
  );
};

export default App;
