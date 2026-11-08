import { useState } from 'react';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // Handle form submission
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      alert("Please select a script file first.");
      return;
    }

    setLoading(true);
    
    // TODO: Connect this to our backend API
    setTimeout(() => {
      setLoading(false);
      alert("File upload logic will be connected soon!");
    }, 1500);
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
            
            {/* Selected File Display */}
            {file && (
              <div className="text-sm text-gray-700 bg-blue-50 px-4 py-2 rounded-md border border-blue-100 w-full max-w-md text-center truncate">
                Selected: <span className="font-medium">{file.name}</span>
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
              {loading ? 'Analyzing Script...' : 'Extract Promos'}
            </button>
          </form>
        </section>

        {/* Results Section (Placeholder for now) */}
        <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 min-h-[300px]">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Extracted Promos</h2>
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p>Upload a script to see generated promos here.</p>
          </div>
        </section>

      </div>
    </div>
  );
}

export default App;