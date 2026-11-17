import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { IngestForm } from './components/IngestForm.js';
import { ItemList } from './components/ItemList.js';
import { QueryPanel } from './components/QueryPanel.js';
import { AnswerDisplay } from './components/AnswerDisplay.js';
import { ErrorBanner } from './components/ErrorBanner.js';
import { fetchItems, deleteItem, submitQuery } from './api/client.js';
import type { Item, QueryResponseDTO } from './types.js';

export const App: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResponseDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshItems = useCallback(async () => {
    try {
      const fetched = await fetchItems();
      setItems(fetched);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch items from server.');
    }
  }, []);

  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  const handleDelete = async (id: number) => {
    try {
      await deleteItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      setError(err?.message || 'Failed to delete item.');
    }
  };

  const handleQuery = async (question: string) => {
    setError(null);
    setIsQuerying(true);
    try {
      const result = await submitQuery(question);
      setQueryResult(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to execute query.');
    } finally {
      setIsQuerying(false);
    }
  };

  const readyItemsCount = items.filter((item) => item.status === 'ready').length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header totalItems={items.length} readyItems={readyItemsCount} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Ingestion & Saved Items */}
          <div className="lg:col-span-5 space-y-6">
            <IngestForm onIngested={refreshItems} />
            <ItemList items={items} onDelete={handleDelete} refreshItems={refreshItems} />
          </div>

          {/* Right Column: Q&A Interface & Citations */}
          <div className="lg:col-span-7 space-y-6">
            <QueryPanel onSubmitQuery={handleQuery} isLoading={isQuerying} />
            <AnswerDisplay
              answer={queryResult?.answer || null}
              sources={queryResult?.sources || []}
              isLoading={isQuerying}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
        AI Knowledge Inbox &middot; Built with Node.js, Express, React, Tailwind &amp; Gemini 2.0
      </footer>
    </div>
  );
};

export default App;
