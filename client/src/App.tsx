import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { IngestForm } from './components/IngestForm.js';
import { ItemList } from './components/ItemList.js';
import { QueryPanel } from './components/QueryPanel.js';
import { AnswerDisplay } from './components/AnswerDisplay.js';
import { ErrorBanner } from './components/ErrorBanner.js';
import { LoginPage } from './components/LoginPage.js';
import { getStoredAuth, clearStoredAuth } from './lib/auth.js';
import { fetchItems, deleteItem, submitQuery } from './api/client.js';
import type { Item, QueryResponseDTO } from './types.js';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => getStoredAuth());
  const [items, setItems] = useState<Item[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResponseDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshItems = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const fetched = await fetchItems();
      setItems(fetched);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch items from server.');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refreshItems();
    }
  }, [isAuthenticated, refreshItems]);

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

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={() => setIsAuthenticated(true)}
      />
    );
  }

  const readyItemsCount = items.filter((item) => item.status === 'ready').length;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-zinc-900 selection:bg-zinc-200">
      <Header
        totalItems={items.length}
        readyItems={readyItemsCount}
        onRefresh={refreshItems}
        isRefreshing={isRefreshing}
        onLogout={() => {
          clearStoredAuth();
          setIsAuthenticated(false);
          setItems([]);
          setQueryResult(null);
          setError(null);
        }}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Collection */}
          <div className="lg:col-span-5 space-y-6">
            <IngestForm onIngested={refreshItems} />
            <ItemList items={items} onDelete={handleDelete} refreshItems={refreshItems} />
          </div>

          {/* Right Column: Inquiry & Evidence */}
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
    </div>
  );
};

export default App;
