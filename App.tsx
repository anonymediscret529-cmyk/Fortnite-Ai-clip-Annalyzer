import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Scan, Brain, Video as VideoIcon, Crosshair, Youtube, FileVideo, Link as LinkIcon, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { analyzeFrame, generateClipSummary, scanVideoKeyframes } from './services/gemini';
import { captureFrame, extractYoutubeId, getYoutubeThumbnailBase64, sampleVideoFrames } from './utils/videoUtils';
import { AnalysisStatus, FrameAnalysis, TimelineEvent } from './types';
import ObjectOverlay from './components/ObjectOverlay';
import AnalysisPanel from './components/AnalysisPanel';
import Timeline from './components/Timeline';

type InputMode = 'file' | 'youtube';

export default function App() {
  const [inputMode, setInputMode] = useState<InputMode>('file');
  
  // File State
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  
  // YouTube State
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeId, setYoutubeId] = useState<string | null>(null);

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Analysis State
  const [currentAnalysis, setCurrentAnalysis] = useState<FrameAnalysis | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [yoloMode, setYoloMode] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Summary & Timeline State
  const [clipSummary, setClipSummary] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle File Upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setCurrentAnalysis(null);
      setClipSummary(null);
      setTimelineEvents([]);
      setStatus(AnalysisStatus.IDLE);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0); // Will update on metadata load
      setErrorMessage(null);
    }
  };

  // Handle YouTube URL
  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractYoutubeId(youtubeUrl);
    
    if (id) {
      setYoutubeId(null);
      setCurrentAnalysis(null);
      setClipSummary(null);
      setTimelineEvents([]);
      setStatus(AnalysisStatus.IDLE);
      setErrorMessage(null);
      
      setTimeout(() => {
        setYoutubeId(id);
      }, 50);
    } else {
      alert("URL YouTube invalide. Veuillez vérifier le lien (supporte vidéos standard et Shorts).");
    }
  };

  // Toggle Play/Pause (Only for file video)
  const togglePlay = () => {
    if (inputMode === 'youtube') return;
    
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
        if (!yoloMode) setCurrentAnalysis(null); 
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle Video Events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);

    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoSrc]);

  // Handle Seeking via Timeline
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Handle Adding Manual Events
  const handleAddEvent = (newEvent: TimelineEvent) => {
    // Insert and sort by timestamp
    setTimelineEvents(prev => [...prev, newEvent].sort((a, b) => a.timestamp - b.timestamp));
  };

  // Analyze Single Frame Logic
  const handleAnalyze = async () => {
    setStatus(AnalysisStatus.PROCESSING);
    setProcessingStep("Capture de l'image...");
    setCurrentAnalysis(null);
    setErrorMessage(null);
    
    try {
      let base64Image: string | null = null;
      let timestamp = 0;

      if (inputMode === 'file') {
        if (!videoRef.current) return;
        videoRef.current.pause();
        setIsPlaying(false);
        base64Image = captureFrame(videoRef.current);
        timestamp = videoRef.current.currentTime;
      } else if (inputMode === 'youtube' && youtubeId) {
        base64Image = await getYoutubeThumbnailBase64(youtubeId);
        timestamp = 0;
      }

      if (!base64Image) throw new Error("Échec de la capture de l'image");

      setProcessingStep("Analyse avec Gemini Vision...");
      const result = await analyzeFrame(base64Image, timestamp);
      setCurrentAnalysis(result);
      setYoloMode(true);
      setStatus(AnalysisStatus.COMPLETE);

    } catch (e: any) {
      console.error(e);
      setStatus(AnalysisStatus.ERROR);
      setErrorMessage(e.message || "Erreur inconnue lors de l'analyse.");
    } finally {
      setProcessingStep(null);
    }
  };

  // Handle Full Clip Analysis (Summary + Timeline)
  const handleClipSummary = async () => {
    if (inputMode !== 'file' || !videoRef.current) return;
    
    setIsGeneratingSummary(true);
    setProcessingStep("Échantillonnage des images...");
    setClipSummary(null);
    setTimelineEvents([]);
    setErrorMessage(null);

    try {
      // Sample more frames for a better timeline (e.g., 8 frames)
      const frames = await sampleVideoFrames(videoRef.current, 8);
      if (frames.length === 0) throw new Error("Impossible de capturer les images");
      
      setProcessingStep("Analyse du gameplay & Scan des événements...");
      
      // Run both tasks in parallel
      const [summaryText, events] = await Promise.all([
        generateClipSummary(frames),
        scanVideoKeyframes(frames)
      ]);

      setClipSummary(summaryText);
      setTimelineEvents(events);

    } catch (e) {
      console.error(e);
      setErrorMessage("Échec de l'analyse du clip. Vérifiez votre clé API ou le format vidéo.");
    } finally {
      setIsGeneratingSummary(false);
      setProcessingStep(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
              <Crosshair size={20} className="text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Fortnite<span className="text-indigo-400">Vision</span></h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs font-bold font-mono text-indigo-400 items-center gap-2">
                <Brain size={14} />
                PROPULSÉ PAR GEMINI 3 FLASH
             </div>
             <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-xs font-bold font-mono text-red-400 flex items-center gap-2">
                <Scan size={14} />
                YOLO ACTIVÉ
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Player & Inputs */}
        <div className="flex-1 flex flex-col gap-6 animate-in slide-in-from-left-4 duration-500">
          
          {/* Input Mode Tabs */}
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 w-fit shadow-md">
            <button 
              onClick={() => { setInputMode('file'); setCurrentAnalysis(null); setClipSummary(null); setTimelineEvents([]); setErrorMessage(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ${inputMode === 'file' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <FileVideo size={16} /> Importer un Clip
            </button>
            <button 
              onClick={() => { setInputMode('youtube'); setCurrentAnalysis(null); setClipSummary(null); setTimelineEvents([]); setErrorMessage(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ${inputMode === 'youtube' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Youtube size={16} /> Lien YouTube
            </button>
          </div>

          {/* YouTube Input Field */}
          {inputMode === 'youtube' && (
            <form onSubmit={handleYoutubeSubmit} className="flex gap-2 animate-in fade-in duration-300">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input 
                  type="text" 
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Collez l'URL YouTube ou Shorts ici..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
              <button 
                type="submit"
                className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors border border-slate-700 whitespace-nowrap"
              >
                Charger la vidéo
              </button>
            </form>
          )}

          {/* Video Container */}
          <div className="relative">
            <div 
              ref={containerRef}
              className="relative aspect-video bg-black rounded-xl border border-slate-800 overflow-hidden shadow-2xl group transition-all duration-300 hover:shadow-indigo-900/10"
            >
              {/* File Mode Placeholder */}
              {inputMode === 'file' && !videoSrc && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-2 animate-bounce">
                    <VideoIcon size={32} />
                  </div>
                  <p>Importez un clip pour commencer l'analyse</p>
                  <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-full font-medium transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/30">
                    <Upload size={18} />
                    Choisir un fichier
                    <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                  </label>
                </div>
              )}

              {/* YouTube Mode Placeholder */}
              {inputMode === 'youtube' && !youtubeId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-2">
                    <Youtube size={32} className="text-red-500" />
                  </div>
                  <p>Entrez une URL YouTube ci-dessus pour charger</p>
                </div>
              )}

              {/* Content Rendering */}
              {inputMode === 'file' && videoSrc && (
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="w-full h-full object-contain"
                  playsInline
                />
              )}

              {inputMode === 'youtube' && youtubeId && (
                <iframe 
                  src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0&playsinline=1`} 
                  title="YouTube video player" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="w-full h-full border-0"
                />
              )}
              
              {/* Processing Overlay */}
              {(status === AnalysisStatus.PROCESSING || isGeneratingSummary) && (
                  <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-300 rounded-xl">
                      <div className="relative mb-4">
                         <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                         <div className="absolute inset-0 flex items-center justify-center">
                            <Brain size={24} className="text-indigo-400 animate-pulse" />
                         </div>
                      </div>
                      <p className="text-indigo-200 font-bold text-lg animate-pulse tracking-wide">
                        {processingStep || "Traitement..."}
                      </p>
                      <p className="text-slate-500 text-xs mt-2 font-mono">
                        Propulsé par Gemini Vision 3 Flash
                      </p>
                  </div>
              )}

              {/* Error Overlay - NEW */}
              {errorMessage && (
                  <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300 rounded-xl p-6 text-center">
                      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle size={32} className="text-red-500" />
                      </div>
                      <h3 className="text-white font-bold text-lg mb-2">Erreur d'Analyse</h3>
                      <p className="text-red-200 text-sm max-w-md mb-6 leading-relaxed">
                        {errorMessage}
                      </p>
                      <button 
                        onClick={() => setErrorMessage(null)}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-full text-sm font-medium transition-colors border border-slate-700"
                      >
                        Fermer
                      </button>
                  </div>
              )}
              
              {/* YOLO Overlay (Works for both if analysis exists) */}
              {(yoloMode || (!isPlaying && inputMode === 'file')) && currentAnalysis && !errorMessage && (
                <ObjectOverlay 
                  objects={currentAnalysis.objects}
                  width={containerRef.current?.clientWidth || 0}
                  height={containerRef.current?.clientHeight || 0}
                  isBuildMode={currentAnalysis.buildMode}
                  className="absolute inset-0 z-10 pointer-events-none"
                />
              )}

              {/* Controls Overlay */}
              {( (inputMode === 'file' && videoSrc) || (inputMode === 'youtube' && youtubeId) ) && !isGeneratingSummary && status !== AnalysisStatus.PROCESSING && !errorMessage && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-4 z-20">
                  
                  {/* Play/Pause only available for files */}
                  {inputMode === 'file' && (
                    <button 
                      onClick={togglePlay}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg shadow-white/10"
                    >
                      {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1"/>}
                    </button>
                  )}

                  {/* Spacer */}
                  <div className="flex-1 flex items-center gap-2">
                    {inputMode === 'youtube' && (
                      <>
                        <p className="hidden sm:flex text-xs text-red-200/70 items-center gap-1">
                            <AlertCircle size={12} />
                            L'analyse utilise la miniature
                        </p>
                        <a 
                          href={`https://www.youtube.com/watch?v=${youtubeId}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-red-600/20 hover:bg-red-600/40 text-red-200 border border-red-500/30 px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink size={10} /> Voir sur YT
                        </a>
                      </>
                    )}
                  </div>

                  <button 
                    onClick={() => setYoloMode(!yoloMode)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${yoloMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50' : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'}`}
                  >
                    <Crosshair size={16} />
                    YOLO : {yoloMode ? 'ON' : 'OFF'}
                  </button>

                  <button 
                    onClick={handleAnalyze}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-900/40 transform active:scale-95 transition-all"
                  >
                    <Scan size={18} />
                    {inputMode === 'file' ? "Analyser l'image" : 'Analyser le clip'}
                  </button>
                </div>
              )}
            </div>

            {/* Timeline Component (Only for file mode for now due to technical limitations with iframe event tracking) */}
            {inputMode === 'file' && videoSrc && (
              <Timeline 
                duration={duration} 
                currentTime={currentTime} 
                events={timelineEvents}
                analyzedTimestamp={currentAnalysis?.timestamp}
                currentAnalysis={currentAnalysis}
                onSeek={handleSeek}
                onAddEvent={handleAddEvent}
              />
            )}
          </div>

          {/* Quick instructions */}
          <div className="flex gap-2 justify-center flex-wrap">
              <div className="px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-400">
                <span className="text-white font-bold mr-1">1.</span> Choisir la source
              </div>
              <div className="px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-400">
                <span className="text-white font-bold mr-1">2.</span> {inputMode === 'file' ? 'Pause Vidéo' : 'Charger URL'}
              </div>
              <div className="px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 text-xs text-slate-400">
                <span className="text-white font-bold mr-1">3.</span> Obtenir les stats Gemini 3 Pro
              </div>
          </div>
        </div>

        {/* Right Column: Analysis Dashboard */}
        <div className="w-full lg:w-96 flex-shrink-0 h-[600px] animate-in slide-in-from-right-4 duration-500 delay-100">
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 h-full shadow-xl overflow-hidden">
               <AnalysisPanel 
                 analysis={currentAnalysis} 
                 isProcessing={status === AnalysisStatus.PROCESSING} 
                 clipSummary={clipSummary}
                 onGenerateClipSummary={inputMode === 'file' ? handleClipSummary : undefined}
                 isGeneratingSummary={isGeneratingSummary}
               />
            </div>
        </div>

      </main>
    </div>
  );
}