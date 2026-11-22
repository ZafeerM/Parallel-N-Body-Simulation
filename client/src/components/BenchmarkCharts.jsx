import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const axis = { fill: '#8b919e', fontSize: 12 };
const tip = { background: '#1e2128', border: '1px solid #2e323c', fontSize: 12 };

function Chart({ title, children }) {
  return (
    <div className="box flex flex-col gap-2">
      <span className="text-sm font-medium">{title}</span>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

export default function BenchmarkCharts({ rows }) {
  const par = rows.filter((r) => r.mode === 'par');
  if (par.length === 0) return null;

  const timeData = rows.map((r) => ({
    name: r.mode === 'seq' ? 'Seq' : `${r.threads}`,
    time: Number((r.totalMs / 1000).toFixed(3)),
  }));
  const scaleData = par.map((r) => ({
    threads: r.threads,
    speedup: Number(r.speedup.toFixed(2)),
    efficiency: Number((r.efficiency * 100).toFixed(1)),
  }));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Chart title="Execution time (s)">
        <BarChart data={timeData}>
          <CartesianGrid stroke="#2e323c" vertical={false} />
          <XAxis dataKey="name" tick={axis} />
          <YAxis tick={axis} width={40} />
          <Tooltip contentStyle={tip} />
          <Bar dataKey="time" fill="#4f8ef7" />
        </BarChart>
      </Chart>

      <Chart title="Speedup">
        <LineChart data={scaleData}>
          <CartesianGrid stroke="#2e323c" />
          <XAxis dataKey="threads" tick={axis} />
          <YAxis tick={axis} width={40} />
          <Tooltip contentStyle={tip} />
          <Line dataKey="speedup" stroke="#4f8ef7" strokeWidth={2} />
        </LineChart>
      </Chart>

      <Chart title="Efficiency (%)">
        <LineChart data={scaleData}>
          <CartesianGrid stroke="#2e323c" />
          <XAxis dataKey="threads" tick={axis} />
          <YAxis tick={axis} width={40} />
          <Tooltip contentStyle={tip} />
          <Line dataKey="efficiency" stroke="#e8a54b" strokeWidth={2} />
        </LineChart>
      </Chart>
    </div>
  );
}
