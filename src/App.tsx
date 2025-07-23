import './App.css'
import { useState } from "react";
import { createMintConsume } from "../lib/createMintConsume";

function App() {
  const [isCreatingNotes, setIsCreatingNotes] = useState(false);

  const handleCreateMintConsume = async () => {
    setIsCreatingNotes(true);
    await createMintConsume();
    setIsCreatingNotes(false);
  };

return (
  <>
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black text-slate-100 px-4 py-8">
      <div className="text-center w-full max-w-xs sm:max-w-sm md:max-w-md">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold mb-6 sm:mb-8">
          Zoro
        </h1>

        <div className="w-full bg-gray-800/20 border border-gray-600 rounded-2xl p-4 sm:p-6 flex flex-col gap-4">
          <button
            onClick={handleCreateMintConsume}
            className="w-full px-4 py-3 sm:px-6 sm:py-3 text-base sm:text-lg cursor-pointer bg-transparent border-2 border-orange-600 text-white rounded-lg transition-all duration-200 hover:bg-orange-600 hover:text-white active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isCreatingNotes}
          >
            {isCreatingNotes ? "Working..." : "Add Liquidity"}
          </button>
        </div>
      </div>
    </main>
  </>
)
}

export default App
