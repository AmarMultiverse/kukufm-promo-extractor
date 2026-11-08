import { useState } from 'react';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [promos, setPromos] = useState([]);
  const [error, setError] = useState("");

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError("");
    }
  };

  // Handle form submission to connect with Backend API
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a script file first.");
      return;
    }

    setLoading(true);
    setError("");
    setPromos([]); // Purane results hata do

    const formData = new FormData();
    formData.append('scriptFile', file);

    try {
      // Connect to our Node.js backend
      const response = await fetch('http://localhost:5000/api/extract-promos', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to extract promos");
      }

      // Backend ne jo JSON array bheja hai wo state me set karo
      if (result.data && result.data.promos) {
        setPromos(result.data.promos);
      } else {
        throw new Error("Invalid response format from AI.");
      }

    } catch (err) {
      console.error(err);
      setError(err.message || "An error occurred while communicating with the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 text-gray-800 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            KukuFM Promo Extractor
          </h1>
          <p className="text-gray-500 text-lg">
            Upload a microdrama script to instantly identify the best hooks and cliffhangers.
          </p>
        </header>

        {/* Upload Section */}
        <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <form onSubmit={handleUpload} className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-md">
              <label 
                htmlFor="file-upload" 
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                  </svg>
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">.TXT files only</p>
                </div>
                <input 
                  id="file-upload" 
                  type="file" 
                  accept=".txt"
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </label>
            </div>
            
            {/* Show Selected File */}
            {file && (
              <div className="text-sm text-gray-700 bg-blue-50 px-4 py-2 rounded-md border border-blue-100 w-full max-w-md text-center truncate">
                Selected: <span className="font-medium">{file.name}</span>
              </div>
            )}

            {/* Show Errors */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-md border border-red-100 w-full max-w-md text-center">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || !file}
              className={`w-full max-w-md py-3 px-4 rounded-lg font-medium text-white transition-all ${
                loading || !file 
                  ? 'bg-blue-300 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? 'AI is analyzing script...' : 'Extract Promos'}
            </button>
          </form>
        </section>

        {/* Results Section */}
        <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 min-h-[300px]">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Extracted Promos</h2>
          
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center h-48 text-blue-500 space-y-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="font-medium text-gray-600">Our LLM is reading the script and finding the best promos...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && promos.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <p>Upload a script to see generated promos here.</p>
            </div>
          )}

          {/* Render Promos List */}
          {!loading && promos.length > 0 && (
            <div className="space-y-6">
              {promos.map((promo, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-blue-100 text-blue-800 text-sm font-bold px-3 py-1 rounded-full">
                      Rank #{promo.rank}
                    </span>
                    <span className="text-gray-600 text-sm font-mono bg-white px-2 py-1 border rounded shadow-sm">
                      ⏱️ {promo.startTime} - {promo.endTime}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Hook (First 3 Sec)</h4>
                      <p className="text-gray-800 font-medium">"{promo.hook}"</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Cliffhanger</h4>
                      <p className="text-gray-800 font-medium">"{promo.cliffhanger}"</p>
                    </div>
                    <div className="pt-3 border-t border-gray-200 mt-4">
                      <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-1">Why it works</h4>
                      <p className="text-gray-700 italic">" {promo.whyItWorks} "</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

export default App;