import { Order } from '../types';
import { formatRupees, formatRupeesCompact } from './currency';

export interface ChartDataPoint {
  x: number;
  y: number;
  y2: number;
  label: string;
  dateLabel: string;
  rawVal1: number;
  rawVal2: number;
  val1: string;
  val2: string;
}

export interface RevenueTrendsResult {
  points: ChartDataPoint[];
  totalCurrentRevenue: number;
  totalPriorRevenue: number;
  maxRevenue: number;
  yAxisLabels: string[];
  areaPath: string;
  primaryLinePath: string;
  comparisonLinePath: string;
  hasData: boolean;
}

export const isEarnedOrder = (order: Order): boolean => {
  const status = (order.status || '').trim().toLowerCase();
  // Delivered and Shipped orders represent fulfilled / confirmed payments
  return status === 'delivered' || status === 'shipped';
};

export const parseOrderTimestamp = (value: unknown): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && 'toMillis' in value && typeof (value as any).toMillis === 'function') {
    return (value as any).toMillis();
  }
  if (typeof value === 'object' && 'toDate' in value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().getTime();
  }
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

// Generate SVG smooth cubic bezier path through points
const generateSmoothPath = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
};

export const calculateRevenueTrends = (
  orders: Order[],
  range: string = 'Last 30 Days',
  referenceDate: Date = new Date()
): RevenueTrendsResult => {
  const now = referenceDate.getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  let numBuckets = 6;
  let bucketDurationMs = 5 * ONE_DAY_MS;
  let totalPeriodMs = 30 * ONE_DAY_MS;
  let bucketLabelFormat: (index: number, bucketStart: Date, bucketEnd: Date) => string;

  const normalizedRange = range.trim().toLowerCase();

  if (normalizedRange.includes('7') || normalizedRange.includes('week')) {
    numBuckets = 7;
    bucketDurationMs = ONE_DAY_MS;
    totalPeriodMs = 7 * ONE_DAY_MS;
    bucketLabelFormat = (_, start) =>
      start.toLocaleDateString('en-US', { weekday: 'short' });
  } else if (normalizedRange.includes('90') || normalizedRange.includes('quarter')) {
    numBuckets = 6;
    bucketDurationMs = 15 * ONE_DAY_MS;
    totalPeriodMs = 90 * ONE_DAY_MS;
    bucketLabelFormat = (i) => `Day ${(i + 1) * 15}`;
  } else if (normalizedRange.includes('month')) {
    numBuckets = 6;
    bucketDurationMs = 5 * ONE_DAY_MS;
    totalPeriodMs = 30 * ONE_DAY_MS;
    bucketLabelFormat = (i) => `Day ${(i + 1) * 5}`;
  } else if (normalizedRange.includes('year')) {
    numBuckets = 6;
    bucketDurationMs = 60 * ONE_DAY_MS;
    totalPeriodMs = 360 * ONE_DAY_MS;
    bucketLabelFormat = (i) => `M${(i + 1) * 2}`;
  } else {
    // Default: Last 30 Days (6 intervals of 5 days: Day 5, Day 10, ... Day 30)
    numBuckets = 6;
    bucketDurationMs = 5 * ONE_DAY_MS;
    totalPeriodMs = 30 * ONE_DAY_MS;
    bucketLabelFormat = (i) => `Day ${(i + 1) * 5}`;
  }

  const currentPeriodStart = now - totalPeriodMs;
  const priorPeriodStart = currentPeriodStart - totalPeriodMs;

  const earnedOrders = orders.filter(isEarnedOrder);

  // Bucket sums
  const currentSums = new Array<number>(numBuckets).fill(0);
  const priorSums = new Array<number>(numBuckets).fill(0);

  earnedOrders.forEach(order => {
    const timestamp = parseOrderTimestamp(order.createdAt || order.date);
    if (!timestamp) return;

    // Check if in current period
    if (timestamp >= currentPeriodStart && timestamp <= now) {
      const offset = timestamp - currentPeriodStart;
      const index = Math.min(numBuckets - 1, Math.max(0, Math.floor(offset / bucketDurationMs)));
      currentSums[index] += order.amount || 0;
    } else if (timestamp >= priorPeriodStart && timestamp < currentPeriodStart) {
      // Prior period
      const offset = timestamp - priorPeriodStart;
      const index = Math.min(numBuckets - 1, Math.max(0, Math.floor(offset / bucketDurationMs)));
      priorSums[index] += order.amount || 0;
    }
  });

  const totalCurrentRevenue = currentSums.reduce((s, v) => s + v, 0);
  const totalPriorRevenue = priorSums.reduce((s, v) => s + v, 0);
  const maxDataRevenue = Math.max(...currentSums, ...priorSums);
  const hasData = maxDataRevenue > 0;

  // Compute a clean ceiling for Y axis
  let maxRevenue = 50000;
  if (hasData) {
    if (maxDataRevenue <= 5000) maxRevenue = 5000;
    else if (maxDataRevenue <= 10000) maxRevenue = 10000;
    else if (maxDataRevenue <= 25000) maxRevenue = 25000;
    else if (maxDataRevenue <= 50000) maxRevenue = 50000;
    else if (maxDataRevenue <= 100000) maxRevenue = 100000;
    else if (maxDataRevenue <= 250000) maxRevenue = 250000;
    else if (maxDataRevenue <= 500000) maxRevenue = 500000;
    else maxRevenue = Math.ceil(maxDataRevenue / 100000) * 100000;
  }

  // 5 Y-axis steps: 100%, 80%, 60%, 40%, 20%, 0%
  const yAxisLabels = [
    formatRupeesCompact(maxRevenue),
    formatRupeesCompact(maxRevenue * 0.8),
    formatRupeesCompact(maxRevenue * 0.6),
    formatRupeesCompact(maxRevenue * 0.4),
    formatRupeesCompact(maxRevenue * 0.2),
    '0'
  ];

  const svgXMin = 40;
  const svgXMax = 640;
  const svgYZero = 230;
  const svgYTop = 30;
  const svgYHeight = svgYZero - svgYTop; // 200

  const points: ChartDataPoint[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const x = numBuckets === 1
      ? (svgXMin + svgXMax) / 2
      : svgXMin + (i * (svgXMax - svgXMin)) / (numBuckets - 1);

    const bStart = new Date(currentPeriodStart + i * bucketDurationMs);
    const bEnd = new Date(currentPeriodStart + (i + 1) * bucketDurationMs);
    const label = bucketLabelFormat(i, bStart, bEnd);
    const dateLabel = `${bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${bEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    const val1Raw = currentSums[i];
    const val2Raw = priorSums[i];

    const y = hasData ? svgYZero - (val1Raw / maxRevenue) * svgYHeight : svgYZero;
    const y2 = hasData ? svgYZero - (val2Raw / maxRevenue) * svgYHeight : svgYZero;

    points.push({
      x: Math.round(x),
      y: Math.round(y),
      y2: Math.round(y2),
      label,
      dateLabel,
      rawVal1: val1Raw,
      rawVal2: val2Raw,
      val1: formatRupees(val1Raw),
      val2: formatRupees(val2Raw)
    });
  }

  const primaryPoints = points.map(p => ({ x: p.x, y: p.y }));
  const comparisonPoints = points.map(p => ({ x: p.x, y: p.y2 }));

  const primaryLinePath = generateSmoothPath(primaryPoints);
  const comparisonLinePath = generateSmoothPath(comparisonPoints);
  const areaPath = primaryPoints.length > 0
    ? `${primaryLinePath} L ${primaryPoints[primaryPoints.length - 1].x} ${svgYZero} L ${primaryPoints[0].x} ${svgYZero} Z`
    : '';

  return {
    points,
    totalCurrentRevenue,
    totalPriorRevenue,
    maxRevenue,
    yAxisLabels,
    areaPath,
    primaryLinePath,
    comparisonLinePath,
    hasData
  };
};
