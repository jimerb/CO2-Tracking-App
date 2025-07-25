import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceArea } from 'recharts';
import { AlertCircle, Wind, TrendingDown } from 'lucide-react';

const CO2Monitor = () => {
  const [measuredPoints, setMeasuredPoints] = useState([]);
  const [projectedPoints, setProjectedPoints] = useState([]);
  const [currentTime, setCurrentTime] = useState('');
  const [currentCO2, setCurrentCO2] = useState('');

  const addDataPoint = () => {
    if (!currentTime || !currentCO2) return;

    const [hours, minutes] = currentTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    
    // Calculate elapsed minutes from first measurement
    let elapsedMinutes;
    if (measuredPoints.length === 0) {
      elapsedMinutes = 0;
    } else {
      const firstPointTime = measuredPoints[0].time.split(':').map(Number);
      const firstPointMinutes = firstPointTime[0] * 60 + firstPointTime[1];
      elapsedMinutes = totalMinutes - firstPointMinutes;
      
      // Handle crossing midnight
      if (elapsedMinutes < 0) {
        elapsedMinutes += 24 * 60;
      } else {
        // If CO2 not decreasing, remove future projections but keep historical
        setProjectedPoints(prev => 
          prev.filter(p => p.minutes < elapsedMinutes).sort((a, b) => a.minutes - b.minutes)
        );
      }
    }
    
    const newPoint = {
      time: currentTime,
      minutes: elapsedMinutes,
      co2: parseInt(currentCO2),
      type: 'measured'
    };

    // Add new measured point
    const updatedMeasured = [...measuredPoints, newPoint];
    setMeasuredPoints(updatedMeasured);

    // Update projections
    if (updatedMeasured.length >= 2) {
      const newSegment = buildProjectionSegment(updatedMeasured);
      
      // Merge new segment with existing projections
      const mergedProjected = mergeProjectionSegments([...projectedPoints, ...newSegment]);
      setProjectedPoints(mergedProjected);
    }

    // Clear inputs
    setCurrentTime('');
    setCurrentCO2('');
  };

  const buildProjectionSegment = (measuredData) => {
    if (measuredData.length < 2) return [];

    const lastTwoPoints = measuredData.slice(-2);
    const [prevPoint, currentPoint] = lastTwoPoints;
    
    // Calculate rate of change (ppm per minute)
    const timeDiff = currentPoint.minutes - prevPoint.minutes;
    const co2Diff = currentPoint.co2 - prevPoint.co2;
    const rate = co2Diff / timeDiff;

    // Only project if CO2 is decreasing
    if (rate >= 0) return [];

    const projectionSegment = [];
    const startMinutes = currentPoint.minutes;
    const startCO2 = currentPoint.co2;

    // Project forward in 5-minute intervals
    for (let i = 5; i <= 120; i += 5) {
      const futureMinutes = startMinutes + i;
      const projectedCO2 = Math.round(startCO2 + (rate * i));
      
      // Stop projecting if CO2 would go below 400 ppm
      if (projectedCO2 < 400) break;
      
      projectionSegment.push({
        minutes: futureMinutes,
        co2: projectedCO2,
        type: 'projected'
      });
    }

    return projectionSegment;
  };

  const mergeProjectionSegments = (allProjected) => {
    // Sort by time and remove duplicates, keeping the most recent projection for each time
    const timeMap = new Map();
    
    allProjected.forEach(point => {
      if (!timeMap.has(point.minutes) || point.type === 'projected') {
        timeMap.set(point.minutes, point);
      }
    });
    
    return Array.from(timeMap.values()).sort((a, b) => a.minutes - b.minutes);
  };

  const formatTime = (minutes) => {
    if (measuredPoints.length === 0) return '';
    
    const firstPointTime = measuredPoints[0].time.split(':').map(Number);
    const firstPointMinutes = firstPointTime[0] * 60 + firstPointTime[1];
    const totalMinutes = firstPointMinutes + minutes;
    
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const clearData = () => {
    setMeasuredPoints([]);
    setProjectedPoints([]);
  };

  const removeLastPoint = () => {
    if (measuredPoints.length === 0) return;
    
    const updatedMeasured = measuredPoints.slice(0, -1);
    setMeasuredPoints(updatedMeasured);
    
    // Rebuild projections from scratch
    if (updatedMeasured.length >= 2) {
      const newSegment = buildProjectionSegment(updatedMeasured);
      setProjectedPoints(newSegment);
    } else {
      setProjectedPoints([]);
    }
  };

  // Combine measured and projected data for the chart
  const chartData = [...measuredPoints, ...projectedPoints].sort((a, b) => a.minutes - b.minutes);

  const getCO2Status = (co2) => {
    if (co2 <= 550) return { text: 'Ideal', color: 'text-green-400', bg: 'bg-green-900/50' };
    if (co2 <= 800) return { text: 'Good', color: 'text-blue-400', bg: 'bg-blue-900/50' };
    if (co2 <= 1000) return { text: 'Concerning', color: 'text-yellow-400', bg: 'bg-yellow-900/50' };
    return { text: 'Poor', color: 'text-red-400', bg: 'bg-red-900/50' };
  };

  // Calculate current status and time to ideal
  const latestMeasured = measuredPoints.length > 0 ? measuredPoints[measuredPoints.length - 1] : null;
  const status = latestMeasured ? getCO2Status(latestMeasured.co2) : null;
  
  let timeToIdeal = null;
  let currentRate = null;
  
  if (measuredPoints.length >= 2 && latestMeasured.co2 > 550) {
    const secondLast = measuredPoints[measuredPoints.length - 2];
    const slope = (latestMeasured.co2 - secondLast.co2) / (latestMeasured.minutes - secondLast.minutes);
    
    if (slope < 0) {
      timeToIdeal = Math.round((550 - latestMeasured.co2) / slope);
      currentRate = -slope * 60; // ppm per hour
    }
  }

  // Prepare chart data - combine measured and projected points
  const allChartData = [...measuredPoints, ...projectedPoints].sort((a, b) => a.minutes - b.minutes);

  // Custom dark theme for chart
  const chartTheme = {
    backgroundColor: '#1f2937',
    textColor: '#9ca3af',
    gridColor: '#374151',
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 text-gray-100 rounded-lg shadow-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 mb-2 flex items-center gap-2">
          <Wind className="text-blue-400" />
          CO2 Ventilation Monitor
        </h1>
        <p className="text-gray-400">Track CO2 levels while ventilating your space</p>
      </div>

      {/* Current Status */}
      {latestMeasured && (
        <div className="mb-6 p-4 rounded-lg bg-blue-900/30 border border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Current CO2 Level</p>
              <p className="text-2xl font-bold text-blue-400">{latestMeasured.co2} ppm</p>
              <p className="text-sm text-blue-400">{status.text}</p>
            </div>
            {measuredPoints.length === 1 && latestMeasured.co2 > 550 && (
              <div className="text-right">
                <p className="text-sm text-gray-300">Est. time to ideal level</p>
                <p className="text-sm text-gray-400">Need 2+ measurements</p>
              </div>
            )}
            {measuredPoints.length >= 2 && latestMeasured.co2 > 550 && (
              <div className="text-right">
                <p className="text-sm text-gray-300">Est. time to ideal level</p>
                {timeToIdeal ? (
                  <>
                    {timeToIdeal > 120 ? (
                      <p className="text-xl font-semibold text-gray-100">{(timeToIdeal / 60).toFixed(1)} hrs</p>
                    ) : (
                      <p className="text-xl font-semibold text-gray-100">{timeToIdeal} min</p>
                    )}
                    <p className="text-sm text-gray-400">(&lt; 550 ppm buffer)</p>
                    <p className="text-xs text-gray-500">-{currentRate.toFixed(0)} ppm/hr</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-400">CO2 not decreasing</p>
                    <p className="text-xs text-gray-500">Check ventilation</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="mb-6 p-4 bg-gray-800/80 rounded-lg border border-gray-700">
        <h3 className="text-lg font-semibold mb-3 text-gray-100">Add Measurement</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">Time</label>
            <input
              type="time"
              value={currentTime}
              onChange={(e) => setCurrentTime(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="HH:MM"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-300 mb-1">CO2 Level (ppm)</label>
            <input
              type="number"
              value={currentCO2}
              onChange={(e) => setCurrentCO2(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 1000"
            />
          </div>
          <button
            onClick={addDataPoint}
            disabled={!currentTime || !currentCO2}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Add
          </button>
          <button
            onClick={clearData}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Chart Section */}
      {measuredPoints.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-100">
            <TrendingDown className="text-green-400" />
            CO2 Trend & Projection
          </h3>
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
            <LineChart width={700} height={400} data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
              <XAxis 
                dataKey="minutes" 
                label={{ value: 'Minutes from start', position: 'insideBottom', offset: -5, fill: chartTheme.textColor }}
                stroke={chartTheme.textColor}
                tick={{ fill: chartTheme.textColor }}
              />
              <YAxis 
                label={{ value: 'CO2 (ppm)', angle: -90, position: 'insideLeft', fill: chartTheme.textColor }}
                domain={[300, 'dataMax + 100']}
                stroke={chartTheme.textColor}
                tick={{ fill: chartTheme.textColor }}
              />
              <Tooltip 
                formatter={(value) => `${value} ppm`}
                labelFormatter={(value) => `${value} min`}
                contentStyle={{ backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '6px' }}
                itemStyle={{ color: '#e5e7eb' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ color: chartTheme.textColor }} />
              
              {/* Reference areas for CO2 levels */}
              <ReferenceArea y1={0} y2={550} strokeOpacity={0} fill="#10b981" fillOpacity={0.15} />
              <ReferenceArea y1={550} y2={800} strokeOpacity={0} fill="#3b82f6" fillOpacity={0.15} />
              <ReferenceArea y1={800} y2={1000} strokeOpacity={0} fill="#eab308" fillOpacity={0.15} />
              <ReferenceArea y1={1000} y2={2000} strokeOpacity={0} fill="#ef4444" fillOpacity={0.15} />
              
              {/* Reference lines */}
              <ReferenceLine y={550} stroke="#10b981" strokeDasharray="5 5" label={{ value: "Ideal (Buffer)", fill: chartTheme.textColor }} />
              <ReferenceLine y={800} stroke="#3b82f6" strokeDasharray="5 5" label={{ value: "Good", fill: chartTheme.textColor }} />
              <ReferenceLine y={1000} stroke="#ef4444" strokeDasharray="5 5" label={{ value: "Poor", fill: chartTheme.textColor }} />
              
              {/* Measured data */}
              <Line 
                type="monotone" 
                dataKey="co2" 
                data={measuredPoints}
                stroke="#60a5fa" 
                strokeWidth={3}
                dot={{ fill: '#60a5fa', r: 6 }}
                name="Measured"
              />
              
              {/* Projected data */}
              {projectedPoints.length > 0 && (
                <Line 
                  type="linear" 
                  dataKey="co2" 
                  data={[...projectedPoints].sort((a, b) => a.minutes - b.minutes)}
                  stroke="#a78bfa" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={(props) => {
                    const { payload, cx, cy } = props;
                    // Hide dots for anchor points that overlap with measured points
                    if (measuredPoints.some(m => m.minutes === payload.minutes)) {
                      return null;
                    }
                    return <circle cx={cx} cy={cy} r={4} fill="#a78bfa" />;
                  }}
                  name="Projected"
                />
              )}
            </LineChart>
          </div>
        </div>
      )}

      {/* Data Table */}
      {measuredPoints.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-100">Recorded Measurements</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-gray-800 border border-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-2 border-b border-gray-700 text-left text-sm font-medium text-gray-300">Time</th>
                  <th className="px-4 py-2 border-b border-gray-700 text-left text-sm font-medium text-gray-300">Minutes Elapsed</th>
                  <th className="px-4 py-2 border-b border-gray-700 text-left text-sm font-medium text-gray-300">CO2 (ppm)</th>
                  <th className="px-4 py-2 border-b border-gray-700 text-left text-sm font-medium text-gray-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {measuredPoints.map((point, index) => {
                  const pointStatus = getCO2Status(point.co2);
                  return (
                    <tr key={index} className="hover:bg-gray-700">
                      <td className="px-4 py-2 border-b border-gray-700 text-sm text-gray-300">{point.time}</td>
                      <td className="px-4 py-2 border-b border-gray-700 text-sm text-gray-300">{point.minutes}</td>
                      <td className="px-4 py-2 border-b border-gray-700 text-sm font-semibold text-gray-100">{point.co2}</td>
                      <td className={`px-4 py-2 border-b border-gray-700 text-sm ${pointStatus.color}`}>{pointStatus.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {measuredPoints.length === 0 && (
        <div className="text-center py-12 bg-gray-800/50 rounded-lg border border-gray-700 mb-6">
          <Wind className="mx-auto h-12 w-12 text-blue-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-200 mb-2">No data yet</h3>
          <p className="text-gray-400">Add your first CO2 measurement to get started</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-900/30 border border-blue-800 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2">
          <AlertCircle size={16} />
          How to use
        </h3>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>Enter the current time and CO2 reading, then click "Add"</li>
          <li>Continue adding measurements every few minutes</li>
          <li>The graph will show your progress and estimate time to ideal levels</li>
          <li>Ideal zone is below 550 ppm (provides buffer before CO2 climbs again)</li>
          <li>Good zone is 550-800 ppm, concerning is 800-1000 ppm</li>
          <li>Click "Clear" to start a new ventilation session</li>
        </ul>
      </div>
    </div>
  );
};

export default CO2Monitor;
