import React from 'react';
import { FrameAnalysis } from '../types';
import { Target, Heart, Shield, Hammer, AlertTriangle, Youtube, ExternalLink, Clapperboard, Loader2, XCircle, ThumbsUp, Lightbulb } from 'lucide-react';

interface AnalysisPanelProps {
  analysis: FrameAnalysis | null;
  isProcessing: boolean;
  clipSummary: string | null;
  onGenerateClipSummary?: () => void;
  isGeneratingSummary: boolean;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  analysis, 
  isProcessing, 
  clipSummary, 
  onGenerateClipSummary, 
  isGeneratingSummary 
}) => {
  if (isProcessing) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 animate-pulse">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-indigo-400 font-mono text-sm">ANALYSE GEMINI FLASH...</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center px-4">
        <Target size={48} className="mb-4 opacity-50" />
        <p>Mettez en pause et cliquez sur "Analyser l'image" pour inspecter.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full overflow-y-auto pr-2 custom-scrollbar pb-6">
      {/* Header Info */}
      <div className="border-b border-slate-800 pb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Target className="text-indigo-500" />
          Analyse Tactique
          <span className="ml-auto text-xs font-mono text-slate-400">
            TS: {analysis.timestamp.toFixed(1)}s
          </span>
        </h3>
        <p className="text-slate-400 text-sm mt-2 leading-relaxed">
          {analysis.summary}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Heart size={16} className="text-rose-500" />
            <span className="text-xs uppercase tracking-wider">Est. Santé</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {analysis.healthEstimate} <span className="text-sm font-normal text-slate-500">%</span>
          </div>
        </div>

        <div className={`p-3 rounded-lg border transition-all duration-300 ${
          analysis.buildMode 
            ? 'bg-blue-900/30 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
            : 'bg-slate-900/50 border-slate-800'
        }`}>
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Hammer size={16} className={analysis.buildMode ? 'text-blue-400' : 'text-blue-500'} />
            <span className={`text-xs uppercase tracking-wider ${analysis.buildMode ? 'text-blue-300' : ''}`}>Mode</span>
          </div>
          <div className={`text-xl font-bold ${analysis.buildMode ? 'text-blue-200' : 'text-white'}`}>
            {analysis.buildMode ? "Construction Active" : "Combat"}
          </div>
        </div>
      </div>

      {/* COACHING SECTION: Mistakes & Advice */}
      <div className="space-y-3">
        {/* Mistakes Section */}
        {analysis.mistakes && analysis.mistakes.length > 0 && (
          <div className="bg-red-950/30 border border-red-500/30 p-4 rounded-lg animate-in slide-in-from-left-2">
            <div className="flex items-center gap-2 text-red-400 mb-3 font-bold text-sm uppercase tracking-wide">
              <XCircle size={16} />
              Erreurs (À Corriger)
            </div>
            <ul className="space-y-2">
              {analysis.mistakes.map((mistake, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-red-200/90 leading-snug">
                   <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                   {mistake}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI Advice (Positive) - Moved here from bottom */}
        <div className="bg-emerald-950/30 border border-emerald-500/20 p-4 rounded-lg animate-in slide-in-from-right-2">
          <div className="flex items-center gap-2 text-emerald-400 mb-2 font-bold text-sm uppercase tracking-wide">
            <Lightbulb size={16} />
            Conseils Tactiques
          </div>
          <p className="text-emerald-100/90 text-sm italic leading-relaxed">
            "{analysis.tacticalAdvice}"
          </p>
        </div>
      </div>

      {/* Detected Objects List */}
      <div>
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Détections YOLO
        </h4>
        <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
          {analysis.objects.length > 0 ? (
            analysis.objects.map((obj, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800/50 text-sm hover:border-indigo-500/30 transition-colors">
                <span className="text-slate-200 capitalize">{obj.label}</span>
                <span className="text-xs font-mono text-slate-500">
                  CONF: {obj.confidence ? Math.round(obj.confidence * 100) : 90}%
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600 italic">Aucune entité détectée dans cette image.</p>
          )}
        </div>
      </div>

      {/* YouTube Resources */}
      {analysis.youtubeSearchQueries && analysis.youtubeSearchQueries.length > 0 && (
        <div className="border-t border-slate-800 pt-4">
           <div className="flex items-center gap-2 text-red-500 mb-3 font-bold text-sm">
            <Youtube size={16} />
            APPRENDRE DES PROS
          </div>
          <div className="space-y-2">
            {analysis.youtubeSearchQueries.map((query, i) => (
              <a 
                key={i}
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between p-3 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-all text-sm"
              >
                <span className="text-slate-300 group-hover:text-white truncate pr-2">{query}</span>
                <ExternalLink size={14} className="text-slate-500 group-hover:text-indigo-400 flex-shrink-0" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Clip Summary Section */}
      <div className="border-t border-slate-800 pt-4 mt-6">
        <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
           <Clapperboard size={16} className="text-purple-400" />
           RÉSUMÉ DU CLIP
        </h4>
        
        {!clipSummary && onGenerateClipSummary && (
          <button
            onClick={onGenerateClipSummary}
            disabled={isGeneratingSummary}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 font-medium text-sm transition-all flex items-center justify-center gap-2"
          >
            {isGeneratingSummary ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Analyse du clip entier...
              </>
            ) : (
              "Générer le résumé de la vidéo"
            )}
          </button>
        )}
        
        {!clipSummary && !onGenerateClipSummary && (
           <p className="text-xs text-slate-600 italic">Résumé complet non disponible pour les sources YouTube.</p>
        )}

        {clipSummary && (
          <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-4 animate-in fade-in zoom-in-95 duration-300">
             <div className="prose prose-invert prose-sm text-purple-100/90 whitespace-pre-line leading-relaxed">
               {clipSummary}
             </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default AnalysisPanel;