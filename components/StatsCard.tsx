interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'yellow' | 'gray';
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: React.ReactNode;
}

export default function StatsCard({ title, value, icon, color = 'blue', trend, subtitle }: StatsCardProps) {
  const colorClasses: Record<NonNullable<StatsCardProps['color']>, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    gray: 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  };

  return (
    <div className="card animate-in fade-in">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{value}</p>
          {subtitle && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</div>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">vs last week</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}