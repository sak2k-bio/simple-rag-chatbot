"use client";

import { useEffect, useState } from 'react';

export default function HealthUI() {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/health').then(async (r) => {
            if (!r.ok) throw new Error(`Status ${r.status}`);
            return r.json();
        }).then(setData).catch((e) => setError(e.message));
    }, []);

    return (
        <main className="min-h-screen p-6 bg-gray-50">
            <h1 className="text-lg font-semibold mb-4">Health Dashboard</h1>
            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded">{error}</div>}
            {!data && !error && <div>Loading...</div>}
            {data && (
                <div className="space-y-4">
                    <div className={`p-3 rounded border ${data.status === 'healthy' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                        <div className="font-medium">Overall: {data.status}</div>
                        <div className="text-sm">Response time: {data.responseTime}ms</div>
                        <div className="text-xs text-gray-500">{data.timestamp}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(data.services || {}).map(([k, v]: any) => (
                            <div key={k} className={`p-3 rounded border ${v.status === 'healthy' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                <div className="font-medium">{k.toUpperCase()}</div>
                                <div className="text-sm">Status: {v.status}</div>
                                {v.responseTime != null && <div className="text-sm">Latency: {v.responseTime}ms</div>}
                                {v.error && <div className="text-xs mt-1">Error: {v.error}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    );
}

