import React, { useRef, useState } from 'react';
import { TimelineEvent, FrameAnalysis } from '../types';
import { 
  Crosshair, Hammer, Package, Activity, Target, 
  Settings, Plus, X, Flag, Skull, Zap, Star, Shield, 
  Check, Car, Heart, Sparkles
} from 'lucide-react';

interface TimelineProps {
  duration: number;
  currentTime: number;
  events: TimelineEvent[];
  analyzedTimestamp?: number | null;
  currentAnalysis?: FrameAnalysis | null;
  onSeek: (time: number) => void;
  onAddEvent?: (event: TimelineEvent) => void;
}

interface EventTypeConfig {
  id: string;
  label: string;
  color: string;
  icon: string;
}

const DEFAULT_TYPES: EventTypeConfig[] = [
  { id: 'combat', label: 'Combat', color: '#EF4444', icon: 'crosshair' }, // Red
  { id: 'build', label: 'Construction', color: '#3B82F6', icon: 'hammer' },     // Blue
  { id: 'loot', label: 'Loot', color: '#EAB308', icon: 'package' },      // Yellow
  { id: 'movement', label: 'Mouvement', color: '#64748B', icon: 'activity' }, // Slate
  { id: 'heal', label: 'Soin', color: '#10B981', icon: 'heart' },        // Green
  { id: 'drive', label: 'Véhicule', color: '#F97316', icon: 'car' },        // Orange
];

const AVAILABLE_ICONS = [
  { id: 'crosshair', icon: Crosshair },
  { id: 'hammer', icon: Hammer },
  { id: 'package', icon: Package },
  { id: 'activity', icon: Activity },
  { id: 'flag', icon: Flag },
  { id: 'skull', icon: Skull },
  { id: 'zap', icon: Zap },
  { id: 'star', icon: Star },
  { id: 'shield', icon: Shield },
  { id: 'car', icon: Car },
  { id: 'heart', icon: Heart },
];

const AVAILABLE_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#10B981', '#06B6D4', 
  '#3B82F6', '#6366F1', '#8B5CF6', '#D946EF', '#F43F5E'
];

const Timeline: React.FC<TimelineProps> = ({ 
  duration, 
  currentTime, 
  events, 
  analyzedTimestamp, 
  currentAnalysis,
  onSeek,
  onAddEvent
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverEvent, setHoverEvent] = useState<TimelineEvent | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [customTypes, setCustomTypes] = useState<EventTypeConfig[]>(DEFAULT_TYPES);
  
  // New Type Form State
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState(AVAILABLE_COLORS[0]);
  const [newTypeIcon, setNewTypeIcon] = useState(AVAILABLE_ICONS[0].id);

  // Manual Event Creation State
  const [isAddMode, setIsAddMode] = useState(false);
  const [pendingEventTime, setPendingEventTime] = useState<number | null>(null);

  const getAllTypes = () => customTypes;

  const getTypeConfig = (type: string) => {
    return getAllTypes().find(t => t.id === type.toLowerCase() || t.label.toLowerCase() === type.toLowerCase()) 
           || getAllTypes().find(t => t.id === 'movement')!;
  };

  const getEventIconComponent = (iconName: string, size: number = 12, className: string = "", style?: React.CSSProperties) => {
    const iconDef = AVAILABLE_ICONS.find(i => i.id === iconName);
    const IconComponent = iconDef ? iconDef.icon : Activity;
    return <IconComponent size={size} className={className} style={style} />;
  };

  // Logic to identify event types from an analysis object
  const getTypesFromAnalysis = (analysis: FrameAnalysis): EventTypeConfig[] => {
    const suggestions = new Set<string>();
    
    if (analysis.buildMode) {
      suggestions.add('build');
    }
    
    analysis.objects.forEach(obj => {
      const label = obj.label.toLowerCase();
      if (label.includes('enemy') || label.includes('player') || label.includes('ennemi') || label.includes('joueur')) suggestions.add('combat');
      if (label.includes('weapon') || label.includes('ammo') || label.includes('chest') || label.includes('loot') || label.includes('arme') || label.includes('coffre')) suggestions.add('loot');
      if (label.includes('vehicle') || label.includes('car') || label.includes('véhicule') || label.includes('voiture')) suggestions.add('drive');
      if (label.includes('medkit') || label.includes('shield') || label.includes('potion') || label.includes('soin')) suggestions.add('heal');
    });

    return Array.from(suggestions)
      .map(id => customTypes.find(t => t.id === id))
      .filter(Boolean) as EventTypeConfig[];
  };

  // Suggestions for the specific clicked time (if close to analysis)
  const getSuggestedTypesForPending = (): EventTypeConfig[] => {
    if (!currentAnalysis || pendingEventTime === null) return [];
    if (Math.abs(currentAnalysis.timestamp - pendingEventTime) > 5) return [];
    return getTypesFromAnalysis(currentAnalysis);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    const time = percent * duration;

    if (isAddMode && onAddEvent) {
        setPendingEventTime(time);
        setIsAddMode(false); // Close add mode after picking spot
    } else {
        onSeek(time);
    }
  };

  const handleCreateType = () => {
    if (!newTypeName.trim()) return;
    const newId = newTypeName.toLowerCase().replace(/\s+/g, '-');
    
    if (customTypes.find(t => t.id === newId)) {
        alert("Ce type existe déjà !");
        return;
    }

    const newType: EventTypeConfig = {
        id: newId,
        label: newTypeName,
        color: newTypeColor,
        icon: newTypeIcon
    };

    setCustomTypes([...customTypes, newType]);
    setNewTypeName('');
  };

  const handleConfirmAddEvent = (typeId: string) => {
    if (pendingEventTime === null || !onAddEvent) return;
    const typeConfig = customTypes.find(t => t.id === typeId);
    
    const newEvent: TimelineEvent = {
        timestamp: pendingEventTime,
        type: typeConfig ? typeConfig.id : 'movement',
        label: typeConfig ? typeConfig.label : 'Événement',
        confidence: 1.0 // Manual events are 100% confident
    };
    
    onAddEvent(newEvent);
    setPendingEventTime(null);
  };

  const handleQuickAdd = (typeId: string) => {
    if (!currentAnalysis || !onAddEvent) return;
    const typeConfig = customTypes.find(t => t.id === typeId);
    
    const newEvent: TimelineEvent = {
        timestamp: currentAnalysis.timestamp,
        type: typeConfig ? typeConfig.id : 'movement',
        label: `Détecté par IA : ${typeConfig?.label || 'Événement'}`,
        confidence: 0.95 
    };
    onAddEvent(newEvent);
  };

  const formatConfidence = (conf: number) => {
    const val = conf <= 1 ? conf * 100 : conf;
    return Math.round(val);
  };

  const suggestedTypes = pendingEventTime !== null ? getSuggestedTypesForPending() : [];
  const detectedTypes = currentAnalysis ? getTypesFromAnalysis(currentAnalysis) : [];

  return (
    <div className="w-full relative mt-4 select-none group">
      
      {/* Top Controls Row */}
      <div className="flex justify-between items-center mb-2 h-8">
         {/* Time Display */}
         <div className="flex gap-3 text-xs text-slate-500 font-mono items-center">
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
         </div>

         {/* Quick Add Buttons */}
         {detectedTypes.length > 0 && (
            <div className="flex-1 flex justify-center items-center gap-2 animate-in fade-in slide-in-from-bottom-2 mx-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase hidden sm:inline-block">
                    <Sparkles size={10} className="inline mr-1 text-indigo-400" />
                    Ajout Rapide :
                </span>
                {detectedTypes.map(t => (
                     <button
                        key={`quick-${t.id}`}
                        onClick={() => handleQuickAdd(t.id)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-800 border border-slate-700 hover:border-indigo-500 hover:bg-indigo-900/20 transition-all text-[10px] group/btn"
                        title={`Ajouter ${t.label} à ${formatTime(currentAnalysis!.timestamp)}`}
                     >
                        {getEventIconComponent(t.icon, 10, "", { color: t.color })}
                        <span style={{ color: t.color }} className="font-medium">{t.label}</span>
                        <Plus size={8} className="text-slate-500 group-hover/btn:text-white" />
                     </button>
                ))}
            </div>
         )}

         {/* Tools */}
         <div className="flex items-center gap-2 ml-auto">
            
            {/* Add Event Toggle */}
            <button
                onClick={() => { setIsAddMode(!isAddMode); setPendingEventTime(null); }}
                className={`p-1.5 rounded-md transition-all ${isAddMode ? 'bg-indigo-600 text-white animate-pulse' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Cliquer sur la timeline pour ajouter"
            >
                <Plus size={14} />
            </button>

            {/* Settings Toggle */}
            <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-1.5 rounded-md transition-colors ${showSettings ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
                <Settings size={14} />
            </button>
         </div>
      </div>

      {/* Settings Panel (Popup) */}
      {showSettings && (
        <div className="absolute right-0 bottom-full mb-2 bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-2xl z-40 w-72 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-white">Types d'événements</h4>
                <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white"><X size={14}/></button>
            </div>
            
            {/* Existing Types List */}
            <div className="flex flex-wrap gap-2 mb-4 max-h-32 overflow-y-auto">
                {customTypes.map(t => (
                    <div key={t.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 text-xs border border-slate-700" style={{ borderColor: t.color }}>
                        {getEventIconComponent(t.icon, 10, "")}
                        <span style={{ color: t.color }}>{t.label}</span>
                    </div>
                ))}
            </div>

            {/* Add New Type Form */}
            <div className="border-t border-slate-800 pt-3">
                <div className="text-xs text-slate-400 mb-2 font-semibold">CRÉER UN TYPE</div>
                <input 
                    type="text" 
                    placeholder="Nom (ex: Snipe)" 
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white mb-2 focus:border-indigo-500 outline-none"
                />
                
                <div className="flex gap-2 mb-2">
                   {/* Color Picker */}
                   <div className="flex-1 grid grid-cols-5 gap-1">
                      {AVAILABLE_COLORS.map(c => (
                          <div 
                            key={c} 
                            onClick={() => setNewTypeColor(c)}
                            className={`h-4 rounded cursor-pointer transition-transform hover:scale-110 ${newTypeColor === c ? 'ring-1 ring-white' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                      ))}
                   </div>
                   {/* Icon Picker */}
                   <div className="w-20 grid grid-cols-3 gap-1 content-start">
                      {AVAILABLE_ICONS.slice(0, 6).map(i => {
                          const Icon = i.icon;
                          return (
                              <div 
                                key={i.id}
                                onClick={() => setNewTypeIcon(i.id)}
                                className={`h-4 flex items-center justify-center rounded cursor-pointer ${newTypeIcon === i.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                              >
                                  <Icon size={10} />
                              </div>
                          )
                      })}
                   </div>
                </div>

                <button 
                    onClick={handleCreateType}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-1.5 rounded font-medium transition-colors"
                >
                    Ajouter Type Personnalisé
                </button>
            </div>
        </div>
      )}

      {/* Manual Event Adder (Popup when pending) */}
      {pendingEventTime !== null && (
         <div 
            className="absolute z-50 bottom-full mb-2 bg-slate-900 border border-indigo-500/50 rounded-lg p-3 shadow-2xl animate-in zoom-in-95 w-56"
            style={{ left: `${(pendingEventTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
         >
             <div className="text-xs font-bold text-center mb-2">Ajouter Événement</div>
             
             {/* AI Suggestions */}
             {suggestedTypes.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-300 mb-1.5 px-1">
                    <Sparkles size={10} className="text-indigo-400" />
                    SUGGÉRÉ
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {suggestedTypes.map(t => (
                        <button 
                            key={`suggest-${t.id}`}
                            onClick={() => handleConfirmAddEvent(t.id)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded bg-indigo-900/30 border border-indigo-500/30 hover:bg-indigo-900/50 text-xs text-left transition-colors group/btn"
                        >
                            {getEventIconComponent(t.icon, 12, "", { color: t.color })}
                            <span className="text-white">{t.label}</span>
                        </button>
                    ))}
                  </div>
                  <div className="h-px bg-slate-800 my-2 mx-1" />
                </div>
             )}

             {/* All Types */}
             <div className="text-[10px] font-bold text-slate-500 mb-1.5 px-1">TOUS LES TYPES</div>
             <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                {customTypes.map(t => (
                    <button 
                        key={t.id}
                        onClick={() => handleConfirmAddEvent(t.id)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 text-xs text-left transition-colors"
                    >
                        {getEventIconComponent(t.icon, 12, "", { color: t.color })}
                        <span style={{ color: t.color }}>{t.label}</span>
                    </button>
                ))}
             </div>
             
             <button 
                onClick={() => setPendingEventTime(null)} 
                className="w-full mt-2 text-[10px] text-slate-500 hover:text-slate-300 py-1"
            >
                Annuler
            </button>
         </div>
      )}

      {/* Timeline Bar Container */}
      <div 
        ref={containerRef}
        onClick={handleClick}
        className={`relative h-6 bg-slate-900 rounded-full cursor-pointer overflow-visible border transition-all duration-300 ${
            isAddMode 
            ? 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)] cursor-crosshair' 
            : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Progress Fill */}
        <div 
          className="absolute top-0 left-0 bottom-0 bg-indigo-600/30 rounded-l-full pointer-events-none transition-all duration-100 ease-linear"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        />

        {/* Current Time Indicator Line */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-10 pointer-events-none transition-all duration-100 ease-linear shadow-[0_0_10px_#6366F1]"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />

        {/* Current Analysis Marker (Triangle) */}
        {analyzedTimestamp !== undefined && analyzedTimestamp !== null && (
          <div 
            className="absolute -top-3 z-20 transform -translate-x-1/2 flex flex-col items-center pointer-events-none transition-all duration-300"
            style={{ left: `${(analyzedTimestamp / duration) * 100}%` }}
          >
             <div className="text-indigo-400 animate-bounce">
                <Target size={16} fill="currentColor" />
             </div>
             <div className="h-9 w-0.5 bg-indigo-400/50 dashed" />
          </div>
        )}

        {/* Pending Event Ghost Marker */}
        {isAddMode && (
             <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden rounded-full pointer-events-none">
                 <div className="w-full h-full bg-indigo-500/5 animate-pulse" />
             </div>
        )}

        {/* Event Markers */}
        {events.map((event, index) => {
          const config = getTypeConfig(event.type);
          const leftPercent = (event.timestamp / duration) * 100;
          
          return (
            <div
              key={index}
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center transform -translate-x-1/2 cursor-pointer z-10 transition-transform hover:scale-125 hover:z-20 shadow-lg"
              style={{ 
                  left: `${leftPercent}%`,
                  backgroundColor: config.color,
                  boxShadow: `0 0 10px ${config.color}80` 
              }}
              onMouseEnter={() => setHoverEvent(event)}
              onMouseLeave={() => setHoverEvent(null)}
              onClick={(e) => {
                e.stopPropagation(); 
                onSeek(event.timestamp);
              }}
            >
              {getEventIconComponent(config.icon, 10, "text-white")}
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoverEvent && (
        <div 
          className="absolute -top-20 z-30 bg-slate-900/95 backdrop-blur-md text-white text-xs px-3 py-2 rounded-lg border border-slate-700 shadow-xl pointer-events-none transform -translate-x-1/2 whitespace-nowrap flex flex-col gap-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-200"
          style={{ left: `${(hoverEvent.timestamp / duration) * 100}%` }}
        >
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-1 mb-0.5">
            <span className="font-bold capitalize flex items-center gap-1.5" style={{ color: getTypeConfig(hoverEvent.type).color }}>
                {getEventIconComponent(getTypeConfig(hoverEvent.type).icon, 12)}
                {getTypeConfig(hoverEvent.type).label}
            </span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              (hoverEvent.confidence > 0.8 || hoverEvent.confidence > 80) ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
            }`}>
              {formatConfidence(hoverEvent.confidence)}%
            </span>
          </div>
          <div className="font-medium text-slate-200 truncate max-w-[200px]">{hoverEvent.label}</div>
          <div className="text-[10px] text-slate-500 font-mono text-right">{formatTime(hoverEvent.timestamp)}</div>
        </div>
      )}
    </div>
  );
};

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default Timeline;