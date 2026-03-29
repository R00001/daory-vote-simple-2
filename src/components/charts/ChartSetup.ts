import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// DAOry color palette for charts
export const CHART_COLORS = {
  cyan: "#00bdd7",
  cyanLight: "#39c3d9",
  cyanAlpha: "rgba(0, 189, 215, 0.15)",
  white: "#ffffff",
  whiteAlpha: "rgba(255, 255, 255, 0.08)",
  whiteAlpha2: "rgba(255, 255, 255, 0.15)",
  muted: "#999999",
  bg: "#060606",
  emerald: "#10b981",
  emeraldAlpha: "rgba(16, 185, 129, 0.15)",
  sky: "#0ea5e9",
  skyAlpha: "rgba(14, 165, 233, 0.15)",
  amber: "#f59e0b",
  amberAlpha: "rgba(245, 158, 11, 0.15)",
  red: "#ef4444",
  purple: "#8b5cf6",
};

export const CHART_FONT = {
  family: "'Inter', sans-serif",
  size: 11,
};

export const SCALE_DEFAULTS = {
  grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
  ticks: { font: CHART_FONT, color: "#666" },
  border: { display: false },
};

export const LEGEND_DEFAULTS = {
  position: "top" as const,
  align: "end" as const,
  labels: {
    font: CHART_FONT,
    color: "#999",
    usePointStyle: true,
    boxWidth: 8,
    padding: 16,
  },
};
