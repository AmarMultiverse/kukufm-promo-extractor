import { useState } from 'react';

const AVAILABLE_MODELS = [
  { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B (Flagship Reasoning - 500 T/s)' },
  { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Ultra-Fast - 1000 T/s)' },
  { id: 'qwen/qwen3.8-27b', name: 'Alibaba Qwen 3.8 27B (High Precision - 450 T/s)' }
];

function App() {
  const [files, setFiles] = useState([]);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ranked'); // 'ranked' | 'episodes' | 'quality'

  // Handle single or multiple file selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
      setError('');
    }
  };

  // Export Raw Outputs as JSON (Required by KukuFM Submission)
  const handleDownloadRawJSON = () => {
    if (!resultData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(resultData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `kukufm_raw_promo_outputs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Submit files to Backend API
  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select at least one screenplay (.txt) file.');
      return;
    }

    setLoading(true);
    setError('');
    setResultData(null);

    const formData = new FormData();
    files.forEach((f) => formData.append('scriptFiles', f));
    formData.append('model', selectedModel);

    try {
      const response = await fetch('http://localhost:5000/api/extract-promos', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to extract promos from server.');
      }

      setResultData(result);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred while communicating with the backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      {/* Top Navbar */}
      <nav className="bg-slate-900 text-white px-8 py-4 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <span className="bg-rose-600 text-white font-black px-3 py-1 rounded text-lg tracking-wider">KUKU</span>
            <h1 className="text-xl font-bold tracking-tight">Microdrama Promo Intelligence Engine</h1>
          </div>
          <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full">
            Problem 1: Automated Promo Finder & Ranker
          </span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 mt-8 space-y-8">
        
        {/* Configuration & Upload Panel */}
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={handleUpload} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* File Dropzone */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  1. Upload Episode Screenplays (.TXT)
                </label>
                <label 
                  htmlFor="file-upload" 
                  className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                    <p className="mb-1 text-sm text-slate-700 font-semibold">
                      Click to select single or multiple episode files
                    </p>
                    <p className="text-xs text-slate-500">
                      Supports batch processing across all 50 episodes at once
                    </p>
                  </div>
                  <input 
                    id="file-upload" 
                    type="file" 
                    accept=".txt"
                    multiple
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {/* Model Selection & Pipeline Info */}
              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    2. Select Inference Model (Auto-Fallback Enabled)
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {AVAILABLE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    Architecture: Regex Timestamp Pre-Parser → LLM Hook/Cliffhanger Evaluation → Deterministic 20s-60s Rule Validator.
                  </p>
                </div>

                {/* Selected Files Counter */}
                {files.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex justify-between items-center">
                    <span className="font-semibold">Selected {files.length} screenplay file(s)</span>
                    <button 
                      type="button" 
                      onClick={() => setFiles([])}
                      className="text-xs text-emerald-700 underline hover:text-emerald-900"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading || files.length === 0}
                  className={`w-full py-3.5 px-6 rounded-xl font-bold text-white transition-all ${
                    loading || files.length === 0 
                      ? 'bg-slate-300 cursor-not-allowed text-slate-500' 
                      : 'bg-rose-600 hover:bg-rose-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  {loading ? `Analyzing ${files.length} Episode(s)...` : 'Find & Rank Best Promos'}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 px-4 py-3 rounded-xl border border-red-200 font-medium">
                Error: {error}
              </div>
            )}
          </form>
        </section>

        {/* Loading Spinner */}
        {loading && (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-rose-600"></div>
            <p className="font-bold text-slate-700 text-lg">Running Hybrid Rule + AI Promo Extraction...</p>
            <p className="text-sm text-slate-500">Parsing timestamps, evaluating 3-second hooks, and ranking cliffhangers.</p>
          </div>
        )}

        {/* Results Dashboard */}
        {!loading && resultData && (
          <div className="space-y-6">
            
            {/* Metrics & Scale Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold">Episodes Analyzed</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{resultData.summary.totalEpisodesProcessed}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold">Total Promos Found</p>
                <p className="text-2xl font-black text-rose-600 mt-1">{resultData.summary.totalPromosExtracted}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold">Active Model Used</p>
                <p className="text-sm font-bold text-slate-800 mt-2 truncate">{resultData.summary.modelUsed}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold">Actual Run Cost</p>
                <p className="text-xl font-black text-emerald-600 mt-1">{resultData.summary.estimatedRunCostUSD}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold">Est. 50-Ep Show Cost</p>
                <p className="text-xl font-black text-blue-600 mt-1">{resultData.summary.projected50EpisodeShowCostUSD}</p>
              </div>
            </div>

            {/* Navigation Tabs & Raw JSON Export */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl border border-slate-200 gap-4">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('ranked')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    activeTab === 'ranked' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Global Ranked Promos ({resultData.globalRankedPromos.length})
                </button>
                <button
                  onClick={() => setActiveTab('quality')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                    activeTab === 'quality' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Quality Check & Failure Analysis
                </button>
              </div>

              <button
                onClick={handleDownloadRawJSON}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-sm transition-colors"
              >
                Download Raw Outputs (.JSON)
              </button>
            </div>

            {/* TAB 1: Global Ranked Promos */}
            {activeTab === 'ranked' && (
              <div className="space-y-4">
                {resultData.globalRankedPromos.map((promo, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-3">
                        <span className="bg-rose-600 text-white text-sm font-black px-3 py-1 rounded-lg">
                          Rank #{promo.globalRank}
                        </span>
                        <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-1 rounded">
                          {promo.episodeName}
                        </span>
                        <h3 className="font-bold text-lg text-slate-900">{promo.promoTitle}</h3>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded">
                          Viral Score: {promo.viralScore}/100
                        </span>
                        <span className="text-slate-700 text-sm font-mono bg-slate-100 px-3 py-1 rounded font-semibold">
                          {promo.startTime} → {promo.endTime} ({promo.calculatedDurationSeconds}s)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <h4 className="text-xs font-black text-rose-600 uppercase tracking-wider mb-1">
                          The Hook (First 3 Seconds)
                        </h4>
                        <p className="text-slate-800 text-sm font-medium">{promo.hook}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <h4 className="text-xs font-black text-indigo-600 uppercase tracking-wider mb-1">
                          The Cliffhanger Cut
                        </h4>
                        <p className="text-slate-800 text-sm font-medium">{promo.cliffhanger}</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <p className="text-sm text-slate-700">
                        <span className="font-bold text-emerald-700 uppercase text-xs mr-2">Why It Works:</span>
                        {promo.whyItWorks}
                      </p>
                      <div className="flex flex-wrap justify-between items-center gap-2 pt-2 text-xs">
                        <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-100">
                          <strong>Editor Quality Risk:</strong> {promo.qualityWarning}
                        </span>
                        <span className={`px-2.5 py-1 rounded font-bold ${
                          promo.isDurationValid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          Rule Check: {promo.ruleValidationFlag}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: Quality Check & Failure Analysis */}
            {activeTab === 'quality' && (
              <div className="space-y-4">
                {resultData.episodeBreakdown.map((ep, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-slate-900 text-lg">{ep.metadata.episodeTitle} ({ep.fileName})</h3>
                      <span className="text-xs bg-slate-100 px-3 py-1 rounded font-mono text-slate-600">
                        Duration: ~{ep.metadata.totalDurationSeconds}s | Beats: {ep.metadata.totalTimestampedBeats}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 italic">{ep.metadata.logline}</p>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-lg mt-3">
                      <h4 className="text-xs font-black text-red-700 uppercase mb-1">
                        Where the AI Tool Picks Badly / Struggles in this Episode:
                      </h4>
                      <p className="text-sm text-slate-800">{ep.episodeFailureAnalysis}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}

export default App;