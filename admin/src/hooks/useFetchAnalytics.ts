import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

type Period = 'today' | '7d' | '30d';

interface PageMetrics {
  page_id: string;
  title: string;
  slug: string;
  domain: string | null;
  pageviews: number;
  uniques: number;
  cta_clicks: number;
  cta_rate: number;
  trend: number;
}

interface AnalyticsSummary {
  total_pageviews: number;
  total_uniques: number;
  total_cta_clicks: number;
  avg_cta_rate: number;
}

interface AnalyticsData {
  period: string;
  summary: AnalyticsSummary;
  pages: PageMetrics[];
}

interface DailyEntry {
  date: string;
  pageviews: number;
  uniques: number;
  cta_clicks: number;
}

interface PageDetail {
  page_id: string;
  title: string;
  period: string;
  summary: PageMetrics;
  daily: DailyEntry[];
  referrers: { referrer: string; count: number }[];
  devices: Record<string, number>;
  utms: { source: string; medium: string; campaign: string; count: number }[];
}

export function useAnalytics(initialPeriod: Period = '7d', autoRefreshMs = 60_000) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<AnalyticsData>(`/analytics?period=${period}`);
      setData(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefreshMs) return;
    const id = setInterval(fetchData, autoRefreshMs);
    return () => clearInterval(id);
  }, [fetchData, autoRefreshMs]);

  return { data, loading, period, setPeriod, refetch: fetchData };
}

export function usePageAnalytics(pageId: string, initialPeriod: Period = '7d', autoRefreshMs = 60_000) {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [data, setData] = useState<PageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<PageDetail>(`/analytics/${pageId}?period=${period}`);
      setData(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [pageId, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefreshMs) return;
    const id = setInterval(fetchData, autoRefreshMs);
    return () => clearInterval(id);
  }, [fetchData, autoRefreshMs]);

  return { data, loading, period, setPeriod, refetch: fetchData };
}
