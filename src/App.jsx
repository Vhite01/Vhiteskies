import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, Cloud, Wind, Droplets, Sun, Thermometer, Eye, 
  Wind as WindIcon, Menu, X, MapPin, Clock, Gauge, Globe, 
  Maximize2, Minimize2, Moon, Navigation, Layout, Settings,
  BarChart3, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_KEY = "5d445c16eaac39b18ca87a89bc27675d"; 
const BASE_URL = "https://api.openweathermap.org/data/2.5";
const GEO_URL = "https://api.openweathermap.org/geo/1.0";

const App = () => {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [airQuality, setAirQuality] = useState(null);
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
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Map Initialization
  useEffect(() => {
    if (!mapInstance.current && window.L) {
      const map = window.L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView(mapCenter, 8);
      mapInstance.current = map;
      updateMapLayer(activeLayer);
    }
    
    if (mapInstance.current) {
      if (baseTileLayer.current) mapInstance.current.removeLayer(baseTileLayer.current);
      const tileUrl = isSatellite 
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : isDarkMode ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      
      baseTileLayer.current = window.L.tileLayer(tileUrl).addTo(mapInstance.current);
    }
  }, [isSatellite, isDarkMode]);

  const getWeatherData = useCallback(async (lat, lon) => {
    try {
      const [curr, fore, air] = await Promise.all([
        fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`).then(r => r.json()),
        fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`).then(r => r.json()),
        fetch(`${BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`).then(r => r.json())
      ]);
      setWeather(curr);
      setForecast(fore);
      setAirQuality(air.list[0]);
      if (mapInstance.current) mapInstance.current.setView([lat, lon], 10);
      setSuggestions([]);
      setSearch("");
    } catch (e) { console.error(e); }
  }, []);

  const updateMapLayer = (layerName) => {
    if (!mapInstance.current) return;
    setActiveLayer(layerName);
    if (weatherLayerInstance.current) mapInstance.current.removeLayer(weatherLayerInstance.current);
    weatherLayerInstance.current = window.L.tileLayer(`https://tile.openweathermap.org/map/${layerName}/{z}/{x}/{y}.png?appid=${API_KEY}`, { opacity: 0.5 }).addTo(mapInstance.current);
  };

  const themeClass = isDarkMode ? "bg-black/70 text-slate-100 border-white/10" : "bg-white/90 text-slate-900 border-black/10";

  return (
    <div className={`relative h-screen w-screen overflow-hidden ${isDarkMode ? 'bg-black' : 'bg-slate-200'}`}>
      <div className="absolute inset-0 z-0" ref={mapContainerRef} />

      {/* Header */}
      <nav className="absolute top-4 left-4 right-4 z-[100] flex items-center justify-between pointer-events-none">
        <div className={`flex items-center gap-3 px-4 py-2 border rounded-2xl backdrop-blur-xl pointer-events-auto ${themeClass}`}>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} title="Toggle Navigation Menu" className="p-2 hover:bg-white/10 rounded-xl">
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
          <Cloud className="text-blue-400" />
          <span className="font-black uppercase tracking-tighter hidden md:block">Vhiteskies</span>
        </div>

        <div className="relative flex-1 max-w-md mx-4 pointer-events-auto group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search location..." 
            className={`w-full py-3 pl-11 pr-4 rounded-2xl border-2 border-blue-500/30 focus:border-green-500/60 transition-all outline-none backdrop-blur-xl ${themeClass}`} 
          />
        </div>

        <div className="flex gap-2 pointer-events-auto">
          <button onClick={() => setIsSatellite(!isSatellite)} title="Switch to Satellite" className={`p-3 border rounded-2xl backdrop-blur-xl ${themeClass} ${isSatellite ? 'bg-blue-500' : ''}`}><Globe className="w-5 h-5"/></button>
          <button onClick={() => setIsFullMap(!isFullMap)} title="Toggle Full Map" className={`p-3 border rounded-2xl backdrop-blur-xl ${themeClass}`}><Maximize2 className="w-5 h-5"/></button>
        </div>
      </nav>

      {/* Layer Controls (Right) */}
      <div className="absolute right-4 top-24 z-50 flex flex-col gap-2">
        {[{id:'precipitation_new', icon:Waves, t:'Rain'}, {id:'wind_new', icon:WindIcon, t:'Wind'}, {id:'temp_new', icon:Thermometer, t:'Temp'}].map(l => (
          <button key={l.id} onClick={() => updateMapLayer(l.id)} title={l.t} className={`p-4 border rounded-2xl backdrop-blur-xl transition-all ${activeLayer === l.id ? 'bg-blue-500 text-white' : themeClass}`}>
            <l.icon className="w-5 h-5"/>
          </button>
        ))}
      </div>

      {/* Bottom Dashboard Area */}
      <AnimatePresence>
        {!isFullMap && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="absolute bottom-6 left-6 right-6 z-40 pointer-events-none flex items-end gap-4 h-[320px]">
            
            {/* 1. LEFT SIDEBAR (Quarter width of progression) */}
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div 
                  initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }}
                  className={`h-full w-1/5 min-w-[180px] border rounded-[2rem] p-6 backdrop-blur-2xl pointer-events-auto flex flex-col gap-6 ${themeClass}`}
                >
                  <div className="space-y-4">
                    <button title="Dashboard Overview" className="flex items-center gap-3 w-full p-2 hover:bg-blue-500/20 rounded-xl transition-colors">
                      <Layout className="w-5 h-5 text-blue-400" /> <span className="text-sm font-bold">Overview</span>
                    </button>
                    <button title="Weather Analytics" className="flex items-center gap-3 w-full p-2 hover:bg-blue-500/20 rounded-xl transition-colors">
                      <BarChart3 className="w-5 h-5 text-emerald-400" /> <span className="text-sm font-bold">Analytics</span>
                    </button>
                    <button title="Severe Weather Alerts" className="flex items-center gap-3 w-full p-2 hover:bg-blue-500/20 rounded-xl transition-colors">
                      <ShieldAlert className="w-5 h-5 text-orange-400" /> <span className="text-sm font-bold">Alerts</span>
                    </button>
                    <button title="App Settings" className="flex items-center gap-3 w-full p-2 hover:bg-blue-500/20 rounded-xl transition-colors">
                      <Settings className="w-5 h-5 text-slate-400" /> <span className="text-sm font-bold">Settings</span>
                    </button>
                  </div>
                  <div className="mt-auto border-t border-white/10 pt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    v2.0 Stable
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 2. CENTER/RIGHT 24h PROGRESSION (The "main" panel) */}
            {forecast && (
              <div className={`h-full flex-1 border rounded-[2rem] p-6 backdrop-blur-2xl pointer-events-auto flex flex-col ${themeClass}`}>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-black uppercase tracking-widest opacity-60">Hourly Forecast</span>
                </div>
                <div className="flex-1 flex gap-6 overflow-x-auto no-scrollbar mask-fade">
                  {forecast.list.slice(0, 12).map((h, i) => (
                    <div key={i} className="min-w-[90px] flex flex-col items-center justify-center p-4 rounded-3xl hover:bg-blue-500/10 transition-all border border-transparent hover:border-blue-500/20">
                      <p className="text-[10px] font-bold opacity-50 mb-2">{new Date(h.dt * 1000).getHours()}:00</p>
                      <img src={`https://openweathermap.org/img/wn/${h.weather[0].icon}@2x.png`} className="w-12 h-12" alt="icon" />
                      <p className="text-xl font-black mt-2">{Math.round(h.main.temp)}°</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. WEATHER STATS (Far Right) */}
            {weather && !isMobile && (
              <div className={`h-full w-[300px] border rounded-[2rem] p-6 backdrop-blur-2xl pointer-events-auto flex flex-col justify-between ${themeClass}`}>
                <div>
                  <h2 className="text-2xl font-black mb-1">{weather.name}</h2>
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">{weather.weather[0].description}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black opacity-50 uppercase">Wind</p>
                      <p className="font-bold">{weather.wind.speed} m/s</p>
                   </div>
                   <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-[8px] font-black opacity-50 uppercase">Humidity</p>
                      <p className="font-bold">{weather.main.humidity}%</p>
                   </div>
                </div>
                <div className="bg-blue-500 text-white p-4 rounded-2xl flex items-center justify-between">
                  <span className="text-sm font-black uppercase">Feels Like</span>
                  <span className="text-2xl font-black">{Math.round(weather.main.feels_like)}°</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sticky Theme Toggle */}
      <button 
        onClick={() => setIsDarkMode(!isDarkMode)}
        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className={`fixed bottom-6 right-6 z-[120] p-4 rounded-full shadow-2xl border-2 transition-all hover:scale-110 active:scale-95 ${isDarkMode ? 'bg-blue-600 border-blue-400 text-white' : 'bg-yellow-400 border-yellow-600 text-black'}`}
      >
        {isDarkMode ? <Sun /> : <Moon />}
      </button>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .mask-fade { mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent); }
        .leaflet-container { background: transparent !important; }
      `}</style>
    </div>
  );
};

export default App;
