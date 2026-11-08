import { useState, useEffect } from 'react';

const MODEL_LABELS = {
  'openai/gpt-oss-120b': 'OpenAI GPT-OSS 120B (Flagship Reasoning - Best Accuracy)',
  'openai/gpt-oss-20b': 'OpenAI GPT-OSS 20B (Ultra-Fast 1000 T/s - High Speed)',
  'qwen/qwen3.8-27b': 'Alibaba Qwen 3.8 27B (Fallback Model - 450 T/s)'
};

function App() {
  const [files, setFiles] = useState([]);
  const [availableModels, setAvailableModels] = useState([
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
  ]);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-oss-120b');
  const [loading, setLoading] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ranked');

  // Sync default model configuration from Backend .env on load
  useEffect(() => {
    fetch('http://localhost:5000/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.configuredModels && data.configuredModels.length > 0) {
          setAvailableModels(data.configuredModels);
          setSelectedModel(data.primaryModel);
        }
      })
      .catch(() => {
        // Silent fallback if backend is not yet started
      });
  }, []);

  // Handle adding files (supports appending or selecting multiple)
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedArray = Array.from(e.target.files);
      selectedArray.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      setFiles(selectedArray);
      setError('');
    }
  };

  // Remove a single file from the selected list
  const handleRemoveFile = (indexToRemove) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Export Raw Outputs as JSON
  const handleDownloadRawJSON = () => {
    if (!resultData) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(resultData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `kukufm_raw_promo_outputs_${Date.now()}.json`);
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
        body: formData
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
      {/* Responsive Top Navbar */}
      <nav className="bg-slate-900 text-white px-4 sm:px-8 py-4 shadow-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-center sm:text-left">
          <div className="flex items-center space-x-3">
            <span className="bg-rose-600 text-white font-black px-3 py-1 rounded text-base sm:text-lg tracking-wider">
              KUKU
            </span>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              Microdrama Promo Intelligence Engine
            </h1>
          </div>
          <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full">
            Problem 1: Automated Promo Finder & Ranker
          </span>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8 space-y-6 sm:space-y-8">
        {/* Configuration & Upload Panel */}
        <section className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
          <form onSubmit={handleUpload} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: File Dropzone & File Name List */}
              <div className="flex flex-col space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    1. Upload Episode Screenplays (.TXT)
                  </label>
                  <label
                    htmlFor="file-upload"
                    className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors p-4"
                  >
                    <div className="flex flex-col items-center justify-center text-center">
                      <svg className="w-8 h-8 mb-2 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-sm text-slate-700 font-semibold">
                        Click to browse single or multiple TXT files
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Supports 1 to 50 episode scripts in a single run
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

                {/* Detailed Uploaded Files List with Names & Sizes */}
                {files.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Uploaded Files ({files.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setFiles([])}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {files.map((f, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs shadow-2xs"
                        >
                          <div className="flex items-center space-x-2 truncate pr-2">
                            <span className="bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded font-bold">
                              #{index + 1}
                            </span>
                            <span className="font-medium text-slate-800 truncate" title={f.name}>
                              {f.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-slate-400 font-mono">
                              {(f.size / 1024).toFixed(1)} KB
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(index)}
                              className="text-slate-400 hover:text-red-600 font-bold px-1 cursor-pointer"
                              title="Remove file"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Model Selection & Submit */}
              <div className="flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700">
                    2. Select Inference Model (Synced with Backend .env)
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    {availableModels.map((modelId) => (
                      <option key={modelId} value={modelId}>
                        {MODEL_LABELS[modelId] || modelId}
                      </option>
                    ))}
                  </select>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-900 space-y-1">
                    <p className="font-bold">Hybrid Architecture Pipeline:</p>
                    <p>1. <strong>Deterministic Code:</strong> Regex extracts scene timestamps, beats & episode bounds.</p>
                    <p>2. <strong>LLM Engine:</strong> Identifies 3-second scroll-stopping hooks & unresolved cliffhangers.</p>
                    <p>3. <strong>Quality Gate:</strong> Verifies 20s-60s duration limits & flags potential editor risks.</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || files.length === 0}
                  className={`w-full py-3.5 px-6 rounded-xl font-bold text-white transition-all cursor-pointer ${
                    loading || files.length === 0
                      ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  {loading
                    ? `Analyzing ${files.length} Episode(s)...`
                    : `Find & Rank Best Promos (${files.length} File${files.length === 1 ? '' : 's'})`}
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

        {/* Loading State */}
        {loading && (
          <div className="bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-rose-600"></div>
            <p className="font-bold text-slate-800 text-base sm:text-lg">
              Running Hybrid Rule + AI Promo Extraction on {files.length} Episode(s)...
            </p>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md">
              Parsing timestamps, extracting continuous & stitched segments, and ranking by viral hook strength.
            </p>
          </div>
        )}

        {/* Results Dashboard */}
        {!loading && resultData && (
          <div className="space-y-6">
            {/* Responsive Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold">Episodes Analyzed</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{resultData.summary.totalEpisodesProcessed}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold">Total Promos Found</p>
                <p className="text-2xl font-black text-rose-600 mt-1">{resultData.summary.totalPromosExtracted}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold">Active Model(s) Used</p>
                <p className="text-sm font-bold text-slate-800 mt-2 truncate" title={resultData.summary.modelUsed}>
                  {resultData.summary.modelUsed}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold">Actual Run Cost</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{resultData.summary.estimatedRunCostUSD}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 uppercase font-bold">Est. 50-Ep Show Cost</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{resultData.summary.projected50EpisodeShowCostUSD}</p>
              </div>
            </div>

            {/* Navigation Tabs & Raw JSON Export */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-white p-4 rounded-xl border border-slate-200 gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTab('ranked')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    activeTab === 'ranked' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Global Ranked Promos ({resultData.globalRankedPromos.length})
                </button>
                <button
                  onClick={() => setActiveTab('quality')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    activeTab === 'quality' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Where It Picks Badly (Quality Check)
                </button>
              </div>
              <button
                onClick={handleDownloadRawJSON}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer text-center"
              >
                Download Raw Outputs (.JSON)
              </button>
            </div>

            {/* TAB 1: Global Ranked Promos */}
            {activeTab === 'ranked' && (
              <div className="space-y-4">
                {resultData.globalRankedPromos.map((promo, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
                    {/* Card Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-rose-600 text-white text-xs sm:text-sm font-black px-3 py-1 rounded-lg">
                          Rank #{promo.globalRank}
                        </span>
                        <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-1 rounded">
                          {promo.episodeName}
                        </span>
                        <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-2.5 py-0.5 rounded">
                          {promo.promoType || 'Continuous Clip'}
                        </span>
                        <h3 className="font-bold text-base sm:text-lg text-slate-900">
                          {promo.promoTitle}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                        <span className="text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded">
                          Viral Score: {promo.viralScore}/100
                        </span>
                        <span className="text-slate-700 text-xs sm:text-sm font-mono bg-slate-100 px-3 py-1 rounded font-semibold">
                          {promo.segments && promo.segments.length > 1
                            ? `${promo.segments.length} Stitched Clips (${promo.calculatedDurationSeconds}s Total)`
                            : `${promo.startTime} → ${promo.endTime} (${promo.calculatedDurationSeconds}s)`}
                        </span>
                      </div>
                    </div>

                    {/* Ordered Segments Breakdown (KukuFM Requirement) */}
                    {promo.segments && promo.segments.length > 0 && (
                      <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Ordered Segment Timestamps ({promo.segments.length} Segment{promo.segments.length > 1 ? 's' : ''})
                        </h4>
                        <div className="space-y-1.5">
                          {promo.segments.map((seg, sIdx) => (
                            <div key={sIdx} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-white px-3 py-2 rounded border border-slate-100 gap-1">
                              <div className="flex items-center space-x-2 shrink-0">
                                <span className="font-bold text-slate-700">Seg #{seg.segmentOrder || sIdx + 1}:</span>
                                <span className="font-mono font-semibold text-rose-600">{seg.startTime} → {seg.endTime}</span>
                                <span className="text-slate-500 font-semibold">({seg.durationSeconds}s)</span>
                              </div>
                              <span className="text-slate-600 italic">{seg.whatHappens}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hook & Cliffhanger Boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-rose-50/40 p-4 rounded-lg border border-rose-100">
                        <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider mb-1">
                          The Hook (First 3 Seconds)
                        </h4>
                        <p className="text-slate-800 text-sm font-medium">{promo.hook}</p>
                      </div>
                      <div className="bg-indigo-50/40 p-4 rounded-lg border border-indigo-100">
                        <h4 className="text-xs font-black text-indigo-700 uppercase tracking-wider mb-1">
                          The Cliffhanger Cut
                        </h4>
                        <p className="text-slate-800 text-sm font-medium">{promo.cliffhanger}</p>
                      </div>
                    </div>

                    {/* Why It Works, Posting Strategy & Quality Check */}
                    <div className="space-y-2 pt-2 text-xs sm:text-sm">
                      <p className="text-slate-700">
                        <span className="font-bold text-emerald-700 uppercase text-xs mr-2">Why It Works:</span>
                        {promo.whyItWorks}
                      </p>
                      {promo.postingStrategy && (
                        <p className="text-slate-700">
                          <span className="font-bold text-blue-700 uppercase text-xs mr-2">Posting Order & Platform Strategy:</span>
                          {promo.postingStrategy}
                        </p>
                      )}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-3 mt-2 border-t border-slate-100 text-xs">
                        <span className="text-amber-800 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                          <strong>Editor Quality Risk:</strong> {promo.qualityWarning}
                        </span>
                        <span className={`px-3 py-1.5 rounded-lg font-bold shrink-0 ${
                          promo.isDurationValid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          Rule Check: {promo.ruleValidationFlag}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: Episode Quality Check & Failure Analysis */}
            {activeTab === 'quality' && (
              <div className="space-y-4">
                {resultData.episodeBreakdown.map((ep, idx) => (
                  <div key={idx} className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm space-y-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                        {ep.metadata.episodeTitle} <span className="text-xs font-normal text-slate-500">({ep.fileName})</span>
                      </h3>
                      <span className="text-xs bg-slate-100 px-3 py-1 rounded font-mono text-slate-600">
                        Episode Length: {ep.metadata.totalDurationSeconds}s | Timestamped Beats: {ep.metadata.totalTimestampedBeats}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 italic">{ep.metadata.logline}</p>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-lg mt-3">
                      <h4 className="text-xs font-black text-red-700 uppercase mb-1">
                        Where the AI Tool Picks Badly / Struggles in this Episode:
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-800">{ep.episodeFailureAnalysis}</p>
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