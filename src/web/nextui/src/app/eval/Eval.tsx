'use client';

import * as React from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import { io as SocketIOClient } from 'socket.io-client';
import { useRouter } from 'next/navigation';

import ResultsView from './ResultsView';
import { API_BASE_URL, IS_RUNNING_LOCALLY } from '@/constants';
import { useStore } from './store';

import type { EvalTable, SharedResults } from './types';

import './Eval.css';

interface EvalOptions {
  fetchId?: string;
  preloadedData?: SharedResults;
  recentFiles?: string[];
}

export default function Eval({
  fetchId,
  preloadedData,
  recentFiles: defaultRecentFiles,
}: EvalOptions) {
  const router = useRouter();
  const { table, setTable, setConfig } = useStore();
  const [loaded, setLoaded] = React.useState<boolean>(false);
  const [failed, setFailed] = React.useState<boolean>(false);
  const [recentFiles, setRecentFiles] = React.useState<string[]>(defaultRecentFiles || []);

  const fetchRecentFiles = async () => {
    if (!IS_RUNNING_LOCALLY) {
      return;
    }
    const resp = await fetch(`${API_BASE_URL}/results`);
    const body = await resp.json();
    setRecentFiles(body.data);
  };

  const handleRecentFileSelection = async (file: string) => {
    const resp = await fetch(`${API_BASE_URL}/results/${file}`);
    const body = await resp.json();
    setTable(body.data.results.table);
    setConfig(body.data.config);
    // TODO(ian): This requires next.js standalone server
    // router.push(`/eval/local:${encodeURIComponent(file)}`);
  };

  React.useEffect(() => {
    if (preloadedData) {
      setTable(preloadedData.data.results?.table as EvalTable);
      setConfig(preloadedData.data.config);
      setLoaded(true);
    } else if (fetchId) {
      const doIt = async () => {
        const response = await fetch(`https://api.promptfoo.dev/eval/${fetchId}`);
        if (!response.ok) {
          setFailed(true);
          return;
        }
        const results = await response.json();
        setTable(results.data.results?.table as EvalTable);
        setConfig(results.data.config);
        setLoaded(true);
      };
      doIt();
    } else if (IS_RUNNING_LOCALLY) {
      const socket = SocketIOClient(API_BASE_URL);

      socket.on('init', (data) => {
        console.log('Initialized socket connection', data);
        setLoaded(true);
        setTable(data.results.table);
        setConfig(data.config);
        fetchRecentFiles();
      });

      socket.on('update', (data) => {
        console.log('Received data update', data);
        setTable(data.results.table);
        setConfig(data.config);
        fetchRecentFiles();
      });

      return () => {
        socket.disconnect();
      };
    } else {
      alert('No preloaded data and not running locally. Configuration error?');
    }
  }, [fetchId, setTable, setConfig, preloadedData]);

  if (failed) {
    return <div className="loading">404 Eval not found</div>;
  }

  if (!loaded || !table) {
    return (
      <div className="loading">
        <div>
          <CircularProgress size={22} />
        </div>
        <div>Loading eval data</div>
      </div>
    );
  }

  return <ResultsView recentFiles={recentFiles} onRecentFileSelected={handleRecentFileSelection} />;
}
