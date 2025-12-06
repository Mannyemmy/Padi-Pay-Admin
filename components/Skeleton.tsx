'use client';

export function SkeletonRow() {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="p-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full"></div>
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <table className="w-full">
      <tbody>
        {[...Array(rows)].map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </tbody>
    </table>
  );
}

export function SkeletonCard() {
  return (
    <div className="card space-y-4">
      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-1/3"></div>
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full"
          ></div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(count)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
