import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

const data: any[] = [];

/**
 * Visualizes projected revenue over time using an AreaChart.
 * Allows filtering by year (currently static in UI).
 */
export function RevenueChart() {
  return (
    <div className="glass-card p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h3 className="text-lg font-bold text-natural-text-main font-serif">Monthly Revenue Overview</h3>
          <p className="text-[0.7rem] text-natural-text-light font-medium uppercase tracking-wider">Revenue trends for the current year</p>
        </div>
        <select className="text-[0.7rem] border border-natural-border rounded-lg px-2 py-1 bg-natural-bg font-semibold text-natural-text-main outline-none uppercase tracking-wider">
          <option>Year 2024</option>
          <option>Year 2023</option>
        </select>
      </div>
      
      <div className="w-full flex-1 min-h-[300px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a68a56" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#a68a56" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E7E0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#8a8b82', fontSize: 10, fontWeight: 500 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#8a8b82', fontSize: 10, fontWeight: 500 }}
                tickFormatter={(value) => `₱${value / 1000}k`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  borderRadius: '8px', 
                  border: '1px solid #E8E7E0',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  fontSize: '11px',
                  fontFamily: 'Inter, sans-serif'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#a68a56" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center border-2 border-dashed border-natural-border rounded-xl bg-natural-bg/10">
            <p className="text-xs text-natural-text-light italic">Insufficient data to generate revenue trends</p>
          </div>
        )}
      </div>
    </div>
  );
}
